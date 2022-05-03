import { CustomResult } from '../common/CustomResult';
import { decryptToken } from '../common/JWT';
import { redisClient } from '../common/redis';
import { getAccountByUserId } from '../services/User';
import { ACCOUNT_CACHE_KEY_STRING } from './CacheKeys';

export interface AccountCache {
  _id: string;
  passwordVersion: number;
  user: {
    _id: string
    username: string;
    hexColor: string;
    tag: string;
    avatar?: string;
    bot?: boolean;
  }
}


export async function getAccountCache(userId: string): Promise<AccountCache | null> {
  // First, check in cache
  const cacheKey = ACCOUNT_CACHE_KEY_STRING(userId);
  const cacheAccount = await redisClient.get(cacheKey);
  if (cacheAccount) {
    return JSON.parse(cacheAccount);
  }
  // If not in cache, fetch from database
  const account = await getAccountByUserId(userId);
  if (!account) return null;

  const accountCache: AccountCache = {
    _id: account.id,
    passwordVersion: account.passwordVersion,
    user: {
      _id: account.user._id.toString(),
      username: account.user.username,
      hexColor: account.user.hexColor,
      tag: account.user.tag,
      avatar: account.user.avatar,
      bot: account.user.bot
    }
  };
  // Save to cache
  await redisClient.set(cacheKey, JSON.stringify(accountCache));
  return accountCache;

}



export async function authenticateUser(token: string): Promise<CustomResult<AccountCache, string>> {
  const decryptedToken = decryptToken(token);
  if (!decryptedToken) {
    return [null, 'Invalid token.'];
  }
  const accountCache = await getAccountCache(decryptedToken.userId);
  if (!accountCache) {
    return [null, 'Invalid token.'];
  }
  // compare password version
  if (accountCache.passwordVersion !== decryptedToken.passwordVersion) {
    return [null, 'Invalid token.'];
  }
  return [accountCache, null];
}

