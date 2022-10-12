import { redisClient } from '../common/redis';
import { RATE_LIMIT_KEY_STRING } from './CacheKeys';

interface CheckRateLimitedOptions {
  id: string,
  expireMS: number,
  requestCount: number
}


// Will return a number if rate limited. Will return false if not rate limited.

export async function checkRateLimited(opts: CheckRateLimitedOptions) {


  const [count, ttl] = await incrementRateLimit(opts.id);

  // Reset if expire time changes (slow down mode)
  if (ttl > opts.expireMS) {
    await setExpireRateLimit({id: opts.id, expireMS: opts.expireMS, currentTTL: -1});
    return false;
  }

  if (count > opts.requestCount) return ttl;
  await setExpireRateLimit({currentTTL: ttl, expireMS: opts.expireMS, id: opts.id});
  return false;

}



async function incrementRateLimit (id: string) {
  const multi = redisClient.multi();
  const key = RATE_LIMIT_KEY_STRING(id);
  multi.incr(key);
  multi.pTTL(key); // Returns the remaining time in ms.
  const response = await multi.exec();
 
  return response as [number, number]; // -> [count, ttl]
}

interface SetExpireOptions {
  id: string
  expireMS: number
  currentTTL: number
}

async function setExpireRateLimit(opts: SetExpireOptions) {
  if (opts.currentTTL !== 1 && opts.currentTTL !== -1) return;
  const key = RATE_LIMIT_KEY_STRING(opts.id);
  redisClient.pExpire(key, opts.expireMS);
}