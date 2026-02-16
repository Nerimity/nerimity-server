import { CustomResult } from '../common/CustomResult';
import { decryptToken } from '../common/JWT';
import { redisClient } from '../common/redis';
import { UserStatus } from '../types/User';
import { getSuspensionDetails, getUserWithAccount, isIpBanned } from '../services/User/User';
import { USER_CACHE_KEY_STRING, ALLOWED_IP_KEY_SET, CONNECTED_SOCKET_ID_KEY_SET, CONNECTED_USER_ID_KEY_STRING, GOOGLE_ACCESS_TOKEN, USER_PRESENCE_KEY_STRING } from './CacheKeys';
import { dateToDateTime, prisma } from '../common/database';
import { generateId } from '../common/flakeId';
import { removeDuplicates } from '../common/utils';
import { hasBit, USER_BADGES } from '../common/Bitwise';
import { addToObjectIfExists } from '../common/addToObjectIfExists';

export interface ActivityStatus {
  socketId: string;
  name: string;
  action: string;
  startedAt?: number;
  endsAt?: number;
  speed?: number;

  imgSrc?: string;
  title?: string;
  subtitle?: string;
  link?: string;
}
export interface Presence {
  userId: string;
  status: number;
  custom?: string | null;
  activity?: ActivityStatus | null;
}

export async function getUserPresences(userIds: string[], includeSocketId = false, hideOffline = true): Promise<Presence[]> {
  const multi = redisClient.multi();
  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i]!;
    const key = USER_PRESENCE_KEY_STRING(userId);
    multi.get(key);
  }

  const results = await multi.exec();

  const presences: Presence[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i] as string;
    if (!result) continue;
    const presence = JSON.parse(result);
    if (hideOffline && presence.status === UserStatus.OFFLINE) continue;
    if (!includeSocketId && presence.activity) {
      delete presence.activity.socketId;
    }
    presences.push(presence);
  }

  return presences;
}

export async function updateCachePresence(
  userId: string,
  presence: Partial<Presence> & {
    userId: string;
  },
): Promise<boolean | Presence> {
  const key = USER_PRESENCE_KEY_STRING(userId);
  const socketIdsKey = CONNECTED_SOCKET_ID_KEY_SET(userId);

  const connectedCount = await redisClient.sCard(socketIdsKey);

  if (connectedCount === 0) return false;

  const currentStatus = await getUserPresences([userId], true, false);

  const isOffline = !currentStatus?.[0]?.status && !presence.status;

  if (presence.custom === null) presence.custom = undefined;
  if (presence.activity === null) presence.activity = undefined;

  await redisClient.set(key, JSON.stringify({ ...currentStatus[0], ...presence }));

  return !isOffline;
}

// returns true if the first user is connected.
export async function addSocketUser(userId: string, socketId: string, presence: Presence) {
  const socketIdsKey = CONNECTED_SOCKET_ID_KEY_SET(userId);
  const userIdKey = CONNECTED_USER_ID_KEY_STRING(socketId);
  const presenceKey = USER_PRESENCE_KEY_STRING(userId);

  const count = await redisClient.sCard(socketIdsKey);

  const multi = redisClient.multi();
  multi.sAdd(socketIdsKey, socketId);
  multi.set(userIdKey, userId);
  if (!count) {
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
  multi.del(userIdKey);
  if (count === 1) {
    multi.del(presenceKey);
  }
  await multi.exec();

  return count === 1;
}

export interface UserCache {
  id: string;
  username: string;
  hexColor?: string;
  tag: string;
  avatar?: string;
  banner?: string;
  badges: number;
  bot?: boolean;
  account?: AccountCache;
  application?: ApplicationCache;

  ip?: string;
  shadowBanned?: boolean;
}

export interface AccountCache {
  id: string;
  emailConfirmed?: boolean;
  passwordVersion: number;
}
export interface ApplicationCache {
  id: string;
  botTokenVersion: number;
}

export async function getUserIdBySocketId(socketId: string) {
  const userId = await redisClient.get(CONNECTED_USER_ID_KEY_STRING(socketId));
  if (!userId) return null;
  return userId;
}

export async function getUserIdsBySocketIds(socketIds: string[]): Promise<string[]> {
  if (!socketIds.length) return [];
  const userIds = await redisClient.mGet(socketIds.map((socketId) => CONNECTED_USER_ID_KEY_STRING(socketId)));
  return removeDuplicates(userIds.filter((id) => id) as string[]);
}

export async function getUserCache(userId: string, beforeCache?: (user: UserCache) => Promise<any | undefined>): Promise<CustomResult<UserCache, { type?: string; message: string; data?: any } | null>> {
  // First, check in cache
  const cacheKey = USER_CACHE_KEY_STRING(userId);
  const cacheUser = await redisClient.get(cacheKey);
  if (cacheUser) {
    return [JSON.parse(cacheUser), null];
  }
  // If not in cache, fetch from database
  const user = await getUserWithAccount(userId);
  if (!user) return [null, null];

  if (!user.application && !user.account) return [null, null];

  const userCache: UserCache = {
    ...(user.account
      ? {
          account: {
            id: user.account!.id,
            passwordVersion: user.account!.passwordVersion,
            emailConfirmed: user.account!.emailConfirmed,
          },
        }
      : {
          application: {
            id: user.application!.id,
            botTokenVersion: user.application!.botTokenVersion,
          },
        }),
    ...(user.shadowBan ? { shadowBanned: true } : {}),
    id: user.id,
    username: user.username,
    badges: user.badges,
    hexColor: user.hexColor || undefined,
    tag: user.tag,
    avatar: user.avatar || undefined,
    banner: user.banner || undefined,
    bot: user.bot || undefined,
  };

  if (beforeCache) {
    const error = await beforeCache(userCache);
    if (error) return [null, error];
  }

  // Save to cache
  await redisClient.set(cacheKey, JSON.stringify(userCache));

  return [userCache, null];
}
export async function updateUserCache(userId: string, update: Partial<UserCache>) {
  const cacheKey = USER_CACHE_KEY_STRING(userId);
  const [user, error] = await getUserCache(userId);
  if (error) return [null, error] as const;
  const newUser = { ...user, ...update };
  await redisClient.set(cacheKey, JSON.stringify(newUser));
  return [newUser, null] as const;
}

export async function removeUserCacheByUserIds(userIds: string[]) {
  if (!userIds.length) return;
  const keys = userIds.map((id) => USER_CACHE_KEY_STRING(id));
  await redisClient.del(keys);
}

const beforeAuthenticateCache = async (user: UserCache): Promise<{ type?: string; message: string; data?: any } | undefined> => {
  const suspendDetails = await getSuspensionDetails(user.id);
  if (suspendDetails)
    return {
      message: 'You are suspended.',
      data: {
        type: 'suspend',
        reason: suspendDetails.reason,
        expire: suspendDetails.expireAt,
        by: { username: suspendDetails.suspendBy?.username },
      },
    };
};

export async function authenticateUser(token: string, ipAddress: string): Promise<CustomResult<UserCache, { type?: string; message: string; data?: any }>> {
  const decryptedToken = decryptToken(token);
  if (!decryptedToken) {
    return [null, { message: 'Invalid token.' }];
  }

  const [userCache, error] = await getUserCache(decryptedToken.userId!, beforeAuthenticateCache);

  if (error) {
    return [null, error];
  }

  if (!userCache) {
    return [null, { message: 'Invalid token.' }];
  }
  // compare password version
  const tokenVersion = userCache.account?.passwordVersion ?? userCache.application?.botTokenVersion;
  if (tokenVersion !== decryptedToken.passwordVersion) {
    return [null, { message: 'Invalid token.' }];
  }

  const isIpAllowed = await isIPAllowedCache(ipAddress);

  const isFounder = hasBit(userCache.badges, USER_BADGES.FOUNDER.bit);

  if (!isIpAllowed || userCache.ip !== ipAddress) {
    const ipBanned = await isIpBanned(ipAddress);
    await addDevice(userCache.id, ipAddress);

    if (ipBanned && !isFounder) {
      return [
        null,
        {
          message: 'You are IP banned.',
          data: {
            type: 'ip-ban',
            expire: ipBanned.expireAt,
          },
        },
      ];
    }
    await addAllowedIPCache(ipAddress);
    await updateUserCache(userCache.id, { ip: ipAddress });
  }

  return [userCache, null];
}

async function addDevice(userId: string, ipAddress: string) {
  // cache this request as well to reduce database calls
  await prisma.userDevice.upsert({
    where: { userId_ipAddress: { userId, ipAddress } },
    update: { lastSeenAt: dateToDateTime() },
    create: { id: generateId(), userId, ipAddress, lastSeenAt: dateToDateTime() },
  });
}

// Moderators Only
export async function getAllConnectedUserIds() {
  const key = USER_PRESENCE_KEY_STRING('*');
  const keys = await redisClient.keys(key);
  return keys.map((k) => k.split(':')[1]);
}

export async function addAllowedIPCache(ipAddress: string) {
  const key = ALLOWED_IP_KEY_SET();
  const multi = redisClient.multi();

  multi.sAdd(key, ipAddress);
  // expire key every 1 hour
  multi.expire(key, 60 * 60);
  await multi.exec();
}

export async function removeAllowedIPsCache(ipAddresses: string[]) {
  if (!ipAddresses.length) return;
  const key = ALLOWED_IP_KEY_SET();
  await redisClient.sRem(key, ipAddresses);
}

export async function isIPAllowedCache(ipAddress: string) {
  const key = ALLOWED_IP_KEY_SET();
  const exists = await redisClient.sIsMember(key, ipAddress);
  return exists;
}

export async function addGoogleAccessTokenCache(userId: string, accessToken: string) {
  const key = GOOGLE_ACCESS_TOKEN(userId);
  const multi = redisClient.multi();
  multi.set(key, accessToken);
  multi.expire(key, 3000);
  return await multi.exec();
}

export async function removeGoogleAccessTokenCache(userId: string) {
  const key = GOOGLE_ACCESS_TOKEN(userId);
  await redisClient.del(key);
}

export async function getGoogleAccessTokenCache(userId: string) {
  const key = GOOGLE_ACCESS_TOKEN(userId);
  const result = await redisClient.get(key);
  if (!result) return null;
  return result;
}
