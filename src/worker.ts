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

(Date.prototype.toJSON as unknown as (this: Date) => number) = function () {
  return this.getTime();
};

const app = express();
const server = http.createServer(app);

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

  app.use(
    rateLimit({
      name: 'global_limit',
      useIP: true,
      restrictMS: 30000,
      requests: 100,
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
  app.use('/api', ApplicationsRouter);
  app.use('/api', RemindersRouter);
}
