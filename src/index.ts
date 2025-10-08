import { cpus } from 'node:os';
import { getPostLikesFromDeletedUsers, prisma } from './common/database';
import { Log } from './common/Log';
import schedule from 'node-schedule';
import { deleteChannelAttachmentBatch, deleteImageBatch } from './common/nerimityCDN';
import env from './common/env';
import { connectRedis, customRedisFlush, redisClient } from './common/redis';
import { getAndRemovePostViewsCache } from './cache/PostViewsCache';
import timers from 'timers/promises';

import cluster from 'node:cluster';
import { createIO } from './socket/socket';
import { deleteAccount, deleteAllApplications, deleteOrLeaveAllServers } from './services/User/UserManagement';
import { createHash } from 'node:crypto';
import { addToObjectIfExists } from './common/addToObjectIfExists';
import { createQueueProcessor } from '@nerimity/mimiqueue';
import { deleteServer } from './services/Server';
import { Prisma } from '@src/generated/prisma/client';
import { isString } from './common/utils';

(Date.prototype.toJSON as unknown as (this: Date) => number) = function () {
  return this.getTime();
};

if (cluster.isPrimary) {
  let cpuCount = cpus().length;

  if (env.DEV_MODE) {
    cpuCount = 1;
  }
  let prismaConnected = false;

  await connectRedis();
  await customRedisFlush();
  await createQueueProcessor({
    prefix: env.TYPE,
    redisClient,
  });

  // await redisClient.hSet('testKey', { test1: 'lol', test2: 'lol2' });

  // console.log(await redisClient.hGetAll('testKey'));

  createIO();
  prisma.$connect().then(() => {
    Log.info('Connected to PostgreSQL');

    if (prismaConnected) return;

    prismaConnected = true;

    if (env.TYPE === 'api') {
      scheduleBumpReset();
      vacuumSchedule();
      scheduleDeleteMessages();
      scheduleDeleteAccountContent();
      removeIPAddressSchedule();
      schedulePostViews();
      scheduleSuspendedAccountDeletion();
      scheduleServerDeletion();
      removeExpiredBannedIpsSchedule();
      removeExpiredSuspensions();
      scheduleWebhookMessagesDelete();
    }
  });

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork({ CLUSTER_INDEX: i });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker process ${worker.process.pid} died.`);
    // have to just restart all clusters because of redis cache issues with socket.io online users.
    process.exit(code);
  });
} else {
  import('./worker');
}

function scheduleBumpReset() {
  // Schedule the task to run every Monday at 0:00 UTC
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = 1;
  rule.hour = 0;
  rule.minute = 0;

  schedule.scheduleJob(rule, async () => {
    await prisma.explore.updateMany({ data: { bumpCount: 0 } });
    Log.info('All public server bumps have been reset to 0.');
  });
}

async function scheduleWebhookMessagesDelete() {
  setInterval(async () => {
    const webhook = await prisma.webhook.findFirst({
      where: {
        deleting: true,
      },
      select: {
        id: true,
        messages: {
          take: 300,
          select: {
            id: true,
            attachments: {
              select: {
                path: true,
              },
            },
          },
        },
      },
    });

    if (!webhook) return;

    const messages = webhook.messages;

    if (!messages.length) {
      await prisma.webhook.delete({ where: { id: webhook.id } });
      return;
    }
    const attachments = messages
      .filter((m) => m.attachments.length)
      .map((m) => m.attachments[0]?.path)
      .filter(isString);
    const messageIds = messages.map((m) => m.id);

    await prisma.message.deleteMany({
      where: { id: { in: messageIds } },
    });

    if (attachments.length) {
      deleteImageBatch(attachments);
    }
  }, 60000);
}

async function scheduleDeleteAccountContent() {
  setInterval(async () => {
    const likedPosts = await getPostLikesFromDeletedUsers();

    if (likedPosts.length) {
      const ids = likedPosts.map((p) => p.id);
      await prisma.postLike.deleteMany({ where: { id: { in: ids } } });
    }

    const rawMessages = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "public"."messages"."id" 
      FROM "public"."messages" 
      LEFT JOIN "public"."users" AS "j0" ON ("j0"."id") = ("public"."messages"."createdById") 
      LEFT JOIN "public"."schedule_account_content_delete" AS "j1" ON ("j1"."userId") = ("j0"."id") 
      WHERE ((NOT ("j1"."userId" IS NULL)) AND ("j0"."id" IS NOT NULL)) LIMIT 300;
    `;
    const messages = !rawMessages.length
      ? []
      : await prisma.message.findMany({
          take: 300,
          select: { id: true, attachments: { select: { path: true } } },
          where: {
            id: { in: rawMessages.map((m) => m.id) },
          },
        });
    const messageAttachments = messages.filter((m) => m.attachments.length).map((m) => m.attachments[0]?.path);
    const messageIds = messages.map((m) => m.id);

    const posts = await prisma.post.findMany({
      take: 300,
      select: { id: true, attachments: { select: { path: true } } },
      where: {
        deleted: false,
        createdBy: {
          scheduledForContentDeletion: { isNot: null },
        },
      },
    });
    const postAttachments = posts.filter((p) => p.attachments.length).map((p) => p.attachments[0]?.path);
    const postIds = posts.map((p) => p.id);
    if (messageIds.length) {
      await prisma.message.deleteMany({
        where: { id: { in: messageIds } },
      });
    }
    if (postIds.length) {
      await prisma.$transaction([
        prisma.post.updateMany({
          where: { id: { in: postIds } },
          data: {
            content: null,
            deleted: true,
          },
        }),
        prisma.post.deleteMany({ where: { repostId: { in: postIds } } }),
        prisma.postLike.deleteMany({ where: { postId: { in: postIds } } }),
        prisma.postPoll.deleteMany({ where: { postId: { in: postIds } } }),
        prisma.attachment.deleteMany({ where: { postId: { in: postIds } } }),
        prisma.announcementPost.deleteMany({ where: { postId: { in: postIds } } }),
        prisma.pinnedPost.deleteMany({ where: { postId: { in: postIds } } }),
      ]);
    }
    if (messages.length || posts.length || likedPosts.length) {
      Log.info(`Deleted ${messages.length} messages & ${posts.length} posts & ${likedPosts.length} liked posts from deleted accounts.`);
    }

    const attachments = [...postAttachments, ...messageAttachments] as string[];

    if (attachments.length) {
      deleteImageBatch(attachments);
    }
  }, 60000);
}

// Messages are not deleted all at once to reduce database strain.
function scheduleDeleteMessages() {
  setInterval(async () => {
    const details = await prisma.scheduleMessageDelete.findFirst();
    if (!details) return;
    if (!details.deletingAttachments && !details.deletingMessages) {
      await prisma.scheduleMessageDelete.delete({
        where: { channelId: details.channelId },
      });
      return;
    }

    if (details.deletingAttachments) {
      const [, err] = await deleteChannelAttachmentBatch(details.channelId);

      if (err?.type && err.type !== 'INVALID_PATH') {
        console.trace(err);
      }

      if (err?.type === 'INVALID_PATH') {
        await prisma.scheduleMessageDelete.update({
          where: { channelId: details.channelId },
          data: { deletingAttachments: false },
        });
      }
    }

    if (!details.deletingMessages) return;

    const deletedCount = await prisma.$executeRaw`
      DELETE FROM "messages"
      WHERE id IN 
      (
          SELECT id 
          FROM "messages"
          WHERE "channelId"=${details.channelId}
          LIMIT 300       
      );
    `;
    if (deletedCount < 300) {
      await prisma.$transaction([
        prisma.scheduleMessageDelete.update({
          where: { channelId: details.channelId },
          data: { deletingMessages: false },
        }),
        prisma.channel.delete({ where: { id: details.channelId } }),
      ]);
    }
    Log.info('Deleted', deletedCount, 'message(s). channelId', details.channelId);
  }, 60000);
}

// run vacuum once everyday.
async function vacuumSchedule() {
  // Schedule the task to run everyday at 0:00 UTC
  const rule = new schedule.RecurrenceRule();
  rule.hour = 0;
  rule.minute = 0;

  schedule.scheduleJob(rule, async () => {
    const res = await prisma.$queryRaw`VACUUM VERBOSE ANALYZE "messages"`;
    console.log('VACUUM RESULT', res);
  });
}

// remove ip addresses that are last seen more than 7 days ago.
async function removeIPAddressSchedule() {
  // Schedule the task to run everyday at 0:00 UTC
  const rule = new schedule.RecurrenceRule();
  rule.hour = 0;
  rule.minute = 0;

  schedule.scheduleJob(rule, async () => {
    await prisma.userDevice.deleteMany({
      where: {
        lastSeenAt: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });
  });
}

async function removeExpiredSuspensions() {
  await prisma.suspension
    .deleteMany({
      limit: 100,
      where: {
        expireAt: {
          not: null,
          lte: new Date(Date.now()),
        },
      },
    })
    .catch((err) => {
      console.error(err);
    });
  await timers.setTimeout(60000); // 1 minute
  removeExpiredSuspensions();
}
async function removeExpiredBannedIps() {
  await prisma.bannedIp.deleteMany({
    where: {
      expireAt: {
        lte: new Date(Date.now()),
      },
    },
  });
}

async function removeExpiredBannedIpsSchedule() {
  await removeExpiredBannedIps();
  // Schedule the task to run everyday at 0:00 UTC
  const rule = new schedule.RecurrenceRule();
  rule.hour = 0;
  rule.minute = 0;

  schedule.scheduleJob(rule, async () => {
    await removeExpiredBannedIps();
  });
}

function schedulePostViews() {
  updatePostViews();
  setInterval(async () => {
    updatePostViews();
  }, 60000 * 60); // every 1 hour
}
async function updatePostViews() {
  const cacheData = await getAndRemovePostViewsCache();
  if (!cacheData.length) return;

  await prisma
    .$transaction(
      cacheData.map((d) =>
        prisma.post.update({
          where: { id: d.id },
          data: { views: { increment: d.views } },
        })
      )
    )
    .catch((err) => console.error(err));
}

function scheduleSuspendedAccountDeletion() {
  const oneMinuteToMilliseconds = 1 * 60 * 1000;
  const fifteenDaysInThePast = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  setTimeout(async () => {
    const suspension = await prisma.suspension.findFirst({
      where: {
        expireAt: null,
        userDeleted: false,
        suspendedAt: {
          lte: fifteenDaysInThePast,
        },
      },
      select: {
        id: true,
        user: { select: { bot: true, id: true, username: true, account: { select: { email: true } } } },
      },
    });
    if (suspension) {
      try {
        const emailSha = suspension.user.account?.email ? createHash('sha256').update(suspension.user.account.email).digest('hex') : undefined;
        Log.info(`Deleting account ${suspension.user.username} because it was perm suspended more than 15 days ago.`);
        await deleteAllApplications(suspension.user.id);
        await deleteOrLeaveAllServers(suspension.user.id);
        await deleteAccount(suspension.user.id, { bot: suspension.user.bot || false, deleteContent: true });
        await prisma.suspension.update({
          where: {
            id: suspension.id,
          },
          data: {
            reason: null,
            userDeleted: true,
            ...addToObjectIfExists('emailHash', emailSha),
          },
        });

        Log.info(`Deleted account ${suspension.user.username}.`);
      } catch (err) {
        console.error(err);
      }
    }

    scheduleSuspendedAccountDeletion();
  }, oneMinuteToMilliseconds);
}
function scheduleServerDeletion() {
  const oneMinuteToMilliseconds = 1 * 60 * 1000;
  const fiveDaysInThePast = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  setTimeout(async () => {
    const scheduleItem = await prisma.scheduleServerDelete.findFirst({
      where: {
        scheduledAt: {
          lte: fiveDaysInThePast,
        },
      },
      select: {
        server: {
          select: { name: true },
        },
        serverId: true,
        scheduledByUserId: true,
      },
    });
    if (scheduleItem) {
      try {
        await deleteServer(scheduleItem.serverId, scheduleItem.scheduledByUserId);
      } catch (err) {
        console.error(err);
      }
    }

    scheduleServerDeletion();
  }, oneMinuteToMilliseconds);
}
