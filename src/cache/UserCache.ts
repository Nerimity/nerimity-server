import { CustomResult } from '../common/CustomResult';
import { decryptToken } from '../common/JWT';
import { redisClient } from '../common/redis';
import { UserStatus } from '../types/User';
import { getAccountByUserId, getSuspensionDetails } from '../services/User';
import { ACCOUNT_CACHE_KEY_STRING, CONNECTED_SOCKET_ID_KEY_SET, CONNECTED_USER_ID_KEY_STRING, USER_PRESENCE_KEY_STRING } from './CacheKeys';


export interface Presence {
  userId: string;
  status: number;
  custom?: string;
}


export async function getUserPresences(userIds: string[]): Promise<Presence[]> {
  const multi = redisClient.multi();
  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const key = USER_PRESENCE_KEY_STRING(userId);
    multi.get(key);
  }

  const results = await multi.exec();

  const presences: Presence[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i] as string;
    if (!result) continue;
    const presence = JSON.parse(result);
    presences.push(presence);
  }

  return presences;
}


export async function updateCachePresence (userId: string, presence: Presence): Promise<boolean> {
  const key = USER_PRESENCE_KEY_STRING(userId);
  
  if (presence.status === UserStatus.OFFLINE) {
    await redisClient.del(key);
    return true;
  }

  await redisClient.set(key, JSON.stringify(presence));
  return true;
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
  if (presence.status !== UserStatus.OFFLINE) {
    multi.set(presenceKey, JSON.stringify(presence));
  }
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
  id: string;
  passwordVersion: number;
  user: UserCache
}

export interface UserCache {
  id: string
  username: string;
  hexColor?: string;
  tag: string;
  avatar?: string;
  banner?: string;
  badges: number;
  bot?: boolean;
}


export async function getUserIdBySocketId(socketId: string) {
  const userId = await redisClient.get(CONNECTED_USER_ID_KEY_STRING(socketId));
  if (!userId) return null;
  return userId;
}

export async function getAccountCache(userId: string, beforeCache?: (account: AccountCache) => Promise<any | undefined>): Promise<CustomResult<AccountCache, {type?: string, message: string, data?: any} | null>> {
  // First, check in cache
  const cacheKey = ACCOUNT_CACHE_KEY_STRING(userId);
  const cacheAccount = await redisClient.get(cacheKey);
  if (cacheAccount) {
    return [JSON.parse(cacheAccount), null];
  }
  // If not in cache, fetch from database
  const account = await getAccountByUserId(userId);
  if (!account) return [null, null];

  const accountCache: AccountCache = {
    id: account.id,
    passwordVersion: account.passwordVersion,
    user: {
      id: account.user.id,
      username: account.user.username,
      badges: account.user.badges,
      hexColor: account.user.hexColor || undefined,
      tag: account.user.tag,
      avatar: account.user.avatar || undefined,
      banner: account.user.banner || undefined,
      bot: account.user.bot || undefined
    }
  };
  
  if (beforeCache) {
    const error = await beforeCache(accountCache);
    if (error) return [null, error];
  }

  // Save to cache
  await redisClient.set(cacheKey, JSON.stringify(accountCache));
  return [accountCache, null];
}

export async function removeAccountsCache(userIds: string[]) {
  const keys = userIds.map(id => ACCOUNT_CACHE_KEY_STRING(id));
  await redisClient.del(keys);
}

const beforeAuthenticateCache = async (account: AccountCache): Promise<{type?: string, message: string, data?: any} | undefined> => {
  const suspendDetails = await getSuspensionDetails(account.user.id);
  if (suspendDetails) return { message: 'You are suspended.', data: {type: 'suspend', reason: suspendDetails.reason, expire: suspendDetails.expireAt}};
};

export async function authenticateUser(token: string): Promise<CustomResult<AccountCache, {type?: string, message: string, data?: any}>> {
  const decryptedToken = decryptToken(token);
  if (!decryptedToken) {
    return [null, {message: 'Invalid token.'}];
  }

  const [accountCache, error] = await getAccountCache(decryptedToken.userId, beforeAuthenticateCache);

  if (error) {
    return [null, error];
  }

  if (!accountCache) {
    return [null, {message: 'Invalid token.'}];
  }
  // compare password version
  if (accountCache.passwordVersion !== decryptedToken.passwordVersion) {
    return [null, {message: 'Invalid token.'}];
  }
  return [accountCache, null];
}



// Moderators Only
export async function getAllConnectedUserIds() {
  const key = USER_PRESENCE_KEY_STRING('*');
  const keys = await redisClient.keys(key);
  return keys.map(k => k.split(':')[1]);
}