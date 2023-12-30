import express from 'express';
import http from 'http';
import env from './common/env';
import { Log } from './common/Log';
import { connectRedis } from './common/redis';
import cors from 'cors';

import { createIO } from './socket/socket';
import { UsersRouter } from './routes/users/Router';
import { ServersRouter } from './routes/servers/Router';
import { ChannelsRouter } from './routes/channels/Router';
import { FriendsRouter } from './routes/friends/Router';
import { prisma } from './common/database';
import { userIP } from './middleware/userIP';
import { rateLimit } from './middleware/rateLimit';
import { ModerationRouter } from './routes/moderation/Router';
import { ExploreRouter } from './routes/explore/Router';
import schedule from 'node-schedule';
import { PostsRouter } from './routes/posts/Router';
import { deleteChannelAttachmentBatch } from './common/nerimityCDN';
import { sendConfirmCodeMail } from './common/mailer';
import { GoogleRouter } from './routes/google/Router';
import { TicketsRouter } from './routes/tickets/Router';
import { EmojisRouter } from './routes/emojis/Router';
import { TenorRouter } from './routes/tenor/Router';

(Date.prototype.toJSON as unknown as (this: Date) => number) = function () {
  return this.getTime();
};

const app = express();
const server = http.createServer(app);

// eslint-disable-next-line no-async-promise-executor
const main = async () => {
  await connectRedis();
  Log.info('Connected to Redis');
  createIO(server);

  prisma.$connect().then(() => {
    Log.info('Connected to PostgreSQL');
    scheduleBumpReset();
    scheduleDeleteMessages();
    removeIPAddressSchedule();
    if (server.listening) return;

    server.listen(env.PORT, () => {
      Log.info('listening on *:' + env.PORT);
    });
  });
};
main();

app.use(
  cors({
    origin: env.ORIGIN,
  })
);

app.use(express.json({ limit: '20MB' }));
app.use(express.urlencoded({ extended: false, limit: '20MB' }));

app.use(userIP);

app.use(
  rateLimit({
    name: 'global_limit',
    useIP: true,
    expireMS: 30000,
    requestCount: 100,
  })
);

app.use('/api', ModerationRouter);
app.use('/api', UsersRouter);
app.use('/api', ServersRouter);
app.use('/api', ChannelsRouter);
app.use('/api', FriendsRouter);
app.use('/api', ExploreRouter);
app.use('/api', PostsRouter);
app.use('/api', GoogleRouter);
app.use('/api', TicketsRouter);
app.use('/api', EmojisRouter);
app.use('/api', TenorRouter);

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
  vacuumSchedule();
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
    await prisma.$queryRaw`VACUUM VERBOSE ANALYZE "Message"`;
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
