import { cpus } from 'node:os';
import { prisma } from './common/database';
import { Log } from './common/Log';
import schedule from 'node-schedule';
import { deleteChannelAttachmentBatch } from './common/nerimityCDN';
import env from './common/env';
import { connectRedis, customRedisFlush } from './common/redis';
import { getAndRemovePostViewsCache } from './cache/PostViewsCache';

import cluster from 'node:cluster';

if (cluster.isPrimary) {
  let cpuCount = cpus().length;

  if (env.DEV_MODE) {
    cpuCount = 1;
  }
  let prismaConnected = false;

  await connectRedis();
  await customRedisFlush();
  prisma.$connect().then(() => {
    Log.info('Connected to PostgreSQL');

    if (prismaConnected) return;

    prismaConnected = true;

    scheduleBumpReset();
    vacuumSchedule();
    scheduleDeleteMessages();
    removeIPAddressSchedule();
    schedulePostViews();
  });

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork({ cpu: i });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker process ${cpuCount} died. Restarting...`);
    cluster.fork();
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
    await prisma.publicServer.updateMany({ data: { bumpCount: 0 } });
    Log.info('All public server bumps have been reset to 0.');
  });
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
      DELETE FROM "Message"
      WHERE id IN 
      (
          SELECT id 
          FROM "Message"
          WHERE "channelId"=${details.channelId}
          LIMIT 1000       
      );
    `;
    if (deletedCount < 1000) {
      await prisma.$transaction([
        prisma.scheduleMessageDelete.update({
          where: { channelId: details.channelId },
          data: { deletingMessages: false },
        }),
        prisma.channel.delete({ where: { id: details.channelId } }),
      ]);
    }
    Log.info('Deleted', deletedCount, 'message(s).');
  }, 60000);
}

// run vacuum once everyday.
async function vacuumSchedule() {
  // Schedule the task to run everyday at 0:00 UTC
  const rule = new schedule.RecurrenceRule();
  rule.hour = 0;
  rule.minute = 0;

  schedule.scheduleJob(rule, async () => {
    const res = await prisma.$queryRaw`VACUUM VERBOSE ANALYZE "Message"`;
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

function schedulePostViews() {
  updatePostViews();
  setInterval(async () => {
    updatePostViews();
  }, 60000 * 60); // every 1 hour
}
async function updatePostViews() {
  const cacheData = await getAndRemovePostViewsCache();
  if (!cacheData.length) return;

  await prisma.$transaction(
    cacheData.map((d) =>
      prisma.post.update({
        where: { id: d.id },
        data: { views: { increment: d.views } },
      })
    )
  );
}
