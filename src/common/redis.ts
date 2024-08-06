import { createClient } from 'redis';
import env from './env';
import { POST_VIEWS_KEY } from '../cache/CacheKeys';

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

export async function customRedisFlush() {
  let keys = await redisClient.keys('*');
  keys = keys.filter((key) => !key.startsWith(POST_VIEWS_KEY('')));
  await redisClient.del(keys);
}
