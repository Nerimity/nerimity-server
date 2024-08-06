import { createClient } from 'redis';
import env from './env';

export const redisClient = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  password: env.REDIS_PASS,
});

export function connectRedis(): Promise<typeof redisClient> {
  return new Promise((resolve, reject) => {
    redisClient.connect();

    redisClient.on('connect', async () => {
      resolve(redisClient);
    });
    redisClient.on('error', (err) => {
      reject(err);
    });
  });
}
