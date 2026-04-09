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

const RATE_LIMIT_SCRIPT = `
local res = redis.call('HGETALL', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])

if #res == 0 then
  redis.call('HSET', KEYS[1], 'requests', 1)
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  return -1
end


local data = {}
for i = 1, #res, 2 do
  data[res[i]] = res[i+1]
end

if data.status == 'REACHED' then
  return ttl
end

if tonumber(data.requests) >= tonumber(ARGV[2]) then
  local trigger = 0
  if ARGV[5] == '1' then
    local count = redis.call('INCR', KEYS[2])
    if count == 1 then
      redis.call('PEXPIRE', KEYS[2], ARGV[4])
    end
    if count >= 3 then
      trigger = 1
      redis.call('DEL', KEYS[2])
    end
  end

  redis.call('HSET', KEYS[1], 'status', 'REACHED')
  redis.call('PEXPIRE', KEYS[1], ARGV[3])

  if trigger == 1 then
    return -2
  end
  return ttl
end

redis.call('HINCRBY', KEYS[1], 'requests', 1)
return -1
`;

export async function checkAndUpdateRateLimit(opts: CheckAndUpdateRateLimitOptions) {
  const key = RATE_LIMIT_KEY_STRING(opts.id);
  const itterKey = opts.onThreeIterations ? RATE_LIMIT_ITTER_KEY_STRING(opts.id + (opts.itterId?.() ?? '')) : 'noop';

  const result = (await redisClient.eval(RATE_LIMIT_SCRIPT, {
    keys: [key, itterKey],
    arguments: [opts.perMS.toString(), opts.requests.toString(), opts.restrictMS.toString(), (3 * 60 * 1000).toString(), opts.onThreeIterations ? '1' : '0'],
  })) as number;

  if (result === -1) {
    return false as const;
  }

  if (result === -2) {
    opts.onThreeIterations?.();
    return await redisClient.pTTL(key);
  }

  return result;
}
