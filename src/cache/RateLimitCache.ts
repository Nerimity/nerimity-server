import { safeExec } from '@src/common/utils';
import { redisClient } from '../common/redis';
import { RATE_LIMIT_ITTER_KEY_STRING, RATE_LIMIT_KEY_STRING } from './CacheKeys';

interface CheckAndUpdateRateLimitOptions {
  id: string;
  requests: number;
  perMS: number;
  restrictMS: number;

  onThreeIterations?: () => void; // Event triggered when user has been rate limited 3 times in the last 3 minutes.
  itterId?: () => string;
}

enum RateLimitStatus {
  REACHED = '1',
}

interface RateLimitCache {
  requests: string;
  status?: RateLimitStatus;
}

export async function checkAndUpdateRateLimit(opts: CheckAndUpdateRateLimitOptions) {
  const key = RATE_LIMIT_KEY_STRING(opts.id);

  // 1. Fetch data - Use Pipeline
  const [res, ttl] = await safeExec<[RateLimitCache, number]>(redisClient.pipeline().hgetall(key).pttl(key));

  // New Key logic
  if (!res || Object.keys(res).length === 0) {
    await redisClient.pipeline().hset(key, { requests: 1 }).pexpire(key, opts.perMS).exec();
    return false as const;
  }

  const requests = parseInt(res.requests);
  if (res.status === RateLimitStatus.REACHED) return ttl;

  // Reached Limit logic
  if (requests >= opts.requests) {
    if (opts.onThreeIterations) {
      const itterKey = RATE_LIMIT_ITTER_KEY_STRING(opts.id + opts.itterId?.());

      const [itterRes] = await safeExec<[number]>(
        redisClient
          .pipeline()
          .incr(itterKey)
          .pexpire(itterKey, 3 * 60 * 1000, 'NX'),
      );

      if (itterRes! >= 3) {
        opts.onThreeIterations();
        await redisClient.del(itterKey);
      }
    }

    await redisClient.pipeline().hset(key, { status: RateLimitStatus.REACHED }).pexpire(key, opts.restrictMS).exec();

    return ttl;
  }

  // Normal Increment
  await redisClient.hincrby(key, 'requests', 1);
  return false as const;
}
