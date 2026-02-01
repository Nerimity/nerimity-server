import { redisClient } from '../common/redis';
import { RATE_LIMIT_ITTER_KEY_STRING, RATE_LIMIT_KEY_STRING } from './CacheKeys';

interface CheckAndUpdateRateLimitOptions {
  id: string,
  requests: number;
  perMS: number;
  restrictMS: number;

  onThreeIterations?: () => void; // Event triggered when user has been rate limited 3 times in the last 3 minutes.
  itterId?: () => string;
}

enum RateLimitStatus {
  REACHED = "1"
}

interface RateLimitCache {
  requests: string;
  status?: RateLimitStatus;

}

export async function checkAndUpdateRateLimit(opts: CheckAndUpdateRateLimitOptions) {
  const key = RATE_LIMIT_KEY_STRING(opts.id);

  const mainMulti = redisClient.multi();
  mainMulti.hGetAll(key);
  mainMulti.pTTL(key);

  const [res, ttl] = await mainMulti.exec() as [RateLimitCache, number];

  if (!res || Object.keys(res).length === 0) {
    const multi = redisClient.multi();
    multi.hSet(key, {
      requests: 1
    });
    multi.pExpire(key, opts.perMS);
    await multi.exec();
    return false as const;
  }

  const requests = parseInt(res.requests);
  const status = res.status;

  if (status === RateLimitStatus.REACHED) {
    return ttl;
  }

  if (requests >= opts.requests) {
    
    if (opts.onThreeIterations) {
      const itterKey = RATE_LIMIT_ITTER_KEY_STRING(opts.id + opts.itterId?.());
      const itterMulti = redisClient.multi();

      itterMulti.incr(itterKey);
      const threeMinutesToMilliseconds = 3 * 60 * 1000;
      itterMulti.pExpire(itterKey, threeMinutesToMilliseconds, "NX")
      const [itterRes] = await itterMulti.exec();
      if (itterRes as number >= 3) {
        opts.onThreeIterations();
        await redisClient.del(itterKey);
      }
    }

    const multi = redisClient.multi();
    multi.hSet(key, {
      status: RateLimitStatus.REACHED
    });
    multi.pExpire(key, opts.restrictMS);
    await multi.exec();
    return ttl;
  }

  await redisClient.HINCRBY(key, "requests", 1);
  return false as const;

}

