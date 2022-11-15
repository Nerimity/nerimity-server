import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import env from './common/env';
import { Log } from './common/Log';
import { connectRedis } from './common/redis';
import cors from 'cors';

import {createIO} from './socket/socket';
import { UsersRouter } from './routes/users/Router';
import { ServersRouter } from './routes/servers/Router';
import { ChannelsRouter } from './routes/channels/Router';
import { FriendsRouter } from './routes/friends/Router';
import { prisma } from './common/database';
import { userIP } from './middleware/userIP';
import { rateLimit } from './middleware/rateLimit';
import { ModerationRouter } from './routes/moderation/Router';

(Date.prototype.toJSON as unknown as (this: Date) => number) = function() {
  return this.getTime();
};

const app = express();
const server = http.createServer(app);

// eslint-disable-next-line no-async-promise-executor
export const main = (): Promise<http.Server> => new Promise(async (resolve) => {
  await connectRedis();
  Log.info('Connected to Redis');
  createIO(server);
  
  prisma.$connect().then(() => {
    Log.info('Connected to PostgreSQL');
    if (server.listening) return;
    server.listen(env.PORT, () => {
      Log.info('listening on *:' + env.PORT);
      resolve(server);
    });
  });
});

if (process.env.TEST !== 'true') {
  main();
}

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.ORIGIN.indexOf(origin) === -1) {
      return callback(null, false);
    }
    return callback(null, true);
    
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(userIP);

app.use(rateLimit({
  name: 'global_limit',
  useIP: true,
  expireMS: 30000,
  requestCount: 100,
}));

app.use('/api', ModerationRouter);
app.use('/api', UsersRouter);
app.use('/api', ServersRouter);
app.use('/api', ChannelsRouter);
app.use('/api', FriendsRouter);


