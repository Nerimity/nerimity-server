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
import { PostsRouter } from './routes/posts/Router';
import { GoogleRouter } from './routes/google/Router';
import { TicketsRouter } from './routes/tickets/Router';
import { EmojisRouter } from './routes/emojis/Router';
import { TenorRouter } from './routes/tenor/Router';
import { ApplicationsRouter } from './routes/applications/Router';
import { OpenGraphRouter } from './routes/open-graph/Router';
import helmet from 'helmet';
import { RemindersRouter } from './routes/reminders/Router';
import { logger } from './common/pino';
import { WebhooksRouter } from './routes/webhooks/Router';
import { getMessagesByChannelId } from './services/Message/Message';

(Date.prototype.toJSON as unknown as (this: Date) => number) = function () {
  return this.getTime();
};

const app = express();
const server = http.createServer(app);

// Middleware to log request duration
// app.use((req, res, next) => {
//   const start = process.hrtime(); // High-resolution time

//   res.on('finish', () => {
//     const end = process.hrtime(start);
//     const durationInMilliseconds = end[0] * 1000 + end[1] / 1e6;
//     logger.info(`${req.method} ${req.originalUrl} - ${durationInMilliseconds.toFixed(3)}ms`);
//   });

//   next();
// });

const main = async () => {
  await connectRedis();
  Log.info('Connected to Redis');
  createIO(server);

  prisma.$connect().then(() => {
    Log.info('Connected to PostgreSQL');

    if (server.listening) return;

    const port = env.TYPE === 'ws' ? env.WS_PORT : env.API_PORT;

    server.listen(port, () => {
      Log.info('listening on *:' + port);
    });
  });
};
main();

app.use(helmet());

app.use(
  cors({
    origin: env.ORIGIN,
  })
);

if (env.TYPE === 'api') {
  app.use(express.json({ limit: '20MB' }));
  app.use(express.urlencoded({ extended: false, limit: '20MB' }));

  app.use(userIP);

  app.use('/api', OpenGraphRouter);

  app.get('/api/debug', async (req, res) => {
    res.json('no');
  });
  app.get('/api/owo', async (req, res) => {
    const t1 = performance.now();
    const result = await getMessagesByChannelId('1289157729608441857 ', {
      requesterId: '1289157673362825217',
    });
    res.setHeader('T-msg-took', (performance.now() - t1).toFixed(2) + 'ms');
    res.json(result);
  });

  app.use(
    rateLimit({
      name: 'global_limit',
      useIP: true,
      restrictMS: 30000,
      requests: 100,
    })
  );

  app.get('/api/uwu', async (req, res) => {
    const t1 = performance.now();
    const result = await getMessagesByChannelId('1289157729608441857 ', {
      requesterId: '1289157673362825217',
    });
    res.setHeader('T-msg-took', (performance.now() - t1).toFixed(2) + 'ms');
    res.json(result);
  });

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
  app.use('/api', ApplicationsRouter);
  app.use('/api', RemindersRouter);
  app.use('/api', WebhooksRouter);
}
