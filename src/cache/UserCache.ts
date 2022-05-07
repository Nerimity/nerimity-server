import { CustomResult } from '../common/CustomResult';
import { decryptToken } from '../common/JWT';
import { redisClient } from '../common/redis';
import { getAccountByUserId } from '../services/User';
import { ACCOUNT_CACHE_KEY_STRING, CONNECTED_SOCKET_ID_KEY_SET, CONNECTED_USER_ID_KEY_STRING, USER_PRESENCE_KEY_STRING } from './CacheKeys';


export interface Presence {
  status: number;
  custom?: string;
}

// returns true if the first user is connected.
export async function addSocketUser(userId: string, socketId: string, presence: Presence) {
  const socketIdsKey =  CONNECTED_SOCKET_ID_KEY_SET(userId);
  const userIdKey =  CONNECTED_USER_ID_KEY_STRING(socketId);
  const presenceKey = USER_PRESENCE_KEY_STRING(userId);

  const count = await redisClient.sCard(socketIdsKey);

  const multi = redisClient.multi();
  multi.sAdd(socketIdsKey, socketId);
  multi.set(userIdKey, userId);
  multi.set(presenceKey, JSON.stringify(presence));
  await multi.exec();

  return count === 0;
}

// returns true if every user is disconnected.
export async function socketDisconnect(socketId: string, userId: string) {
  const userIdKey = CONNECTED_USER_ID_KEY_STRING(socketId);
  const socketIdsKey = CONNECTED_SOCKET_ID_KEY_SET(userId);
  const presenceKey = USER_PRESENCE_KEY_STRING(userId);

  const count = await redisClient.sCard(socketIdsKey);
  if (!count) return;

  const multi = redisClient.multi();
  multi.sRem(socketIdsKey, socketId);
  if (count === 1) {
    multi.del(userIdKey);
    multi.del(presenceKey);
  }
  await multi.exec();

  return count === 1;
}

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


export async function getAccountCacheBySocketId(socket: string) {
  const userId = await redisClient.get(CONNECTED_USER_ID_KEY_STRING(socket));
  if (!userId) return null;
  return getAccountByUserId(userId);
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

