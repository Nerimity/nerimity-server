import { createClient } from 'redis';
import env from './env';
import { POST_VIEWS_KEY, WS_KEYS } from '../cache/CacheKeys';
import { Log } from './Log';

export const redisClient = createClient({
  socket: {
    ...(env.REDIS_PATH ? { path: env.REDIS_PATH } : {}),
    ...(env.REDIS_HOST ? { host: env.REDIS_HOST } : {}),
    ...(env.REDIS_PORT ? { port: env.REDIS_PORT } : {}),
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
  keys = keys.filter((key) => !key.startsWith('mq:'));
  keys = keys.filter((key) => !key.startsWith('mq-'));

  if (env.TYPE === 'ws') {
    keys = keys.filter((key) => WS_KEYS.find((k) => key.startsWith(k)));
  } else {
    keys = keys.filter((key) => !WS_KEYS.find((k) => key.startsWith(k)));
  }

  if (!keys.length) return;
  await redisClient.del(keys);
  Log.info('Redis: Flushed', keys.length, 'keys');
}
