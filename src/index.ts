import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import env from './common/env';
import { Log } from './common/Log';
import { connectRedis } from './common/redis';
import fastifyCors from '@fastify/cors';
import cors from 'cors';
import Fastify from 'fastify';
import ExpressPlugin from '@fastify/express';

import {createIO} from './socket/socket';
import { UsersRouter } from './routes/users/Router';
import { ServersRouter } from './routes/servers/Router';
import { ChannelsRouter } from './routes/channels/Router';
import { FriendsRouter } from './routes/friends/Router';
import { prisma } from './common/database';





const fastify = Fastify({
  logger: true,
});

// eslint-disable-next-line no-async-promise-executor
export const main = (): Promise<http.Server> => new Promise(async (resolve) => {
  await fastify.register(ExpressPlugin);
  registerRoutes();
  await connectRedis();
  Log.info('Connected to Redis');
  createIO(fastify.server);
  
  prisma.$connect().then(() => {
    Log.info('Connected to PostgreSQL');
    fastify.listen({port: env.PORT}, () => {
      Log.info('listening on *:' + env.PORT);
      resolve(fastify.server);
    });
  });
});

if (process.env.TEST !== 'true') {
  main();
}


async function registerRoutes() {
  
  await fastify.register(fastifyCors, {
    origin: '*',
  });

  fastify.use(cors());
  fastify.use(express.json());
  fastify.use(express.urlencoded({ extended: false }));
  fastify.use('/api', UsersRouter);  
  fastify.use('/api', ServersRouter);
  fastify.use('/api', ChannelsRouter);
  fastify.use('/api', FriendsRouter);
}  
