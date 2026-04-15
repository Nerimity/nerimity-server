import { CustomResult } from '../common/CustomResult';
import { decryptToken, generateToken } from '../common/JWT';
import { redisClient } from '../common/redis';
import { UserStatus } from '../types/User';
import { getSuspensionDetails, getUserWithAccount, isIpBanned } from '../services/User/User';
import { USER_CACHE_KEY_STRING, ALLOWED_IP_KEY_SET, CONNECTED_SOCKET_ID_KEY_SET, CONNECTED_USER_ID_KEY_STRING, GOOGLE_DRIVE_ACCESS_TOKEN, USER_PRESENCE_KEY_STRING, SESSION_ID_TO_USER_ID, SESSION_IP_KEY_SET } from './CacheKeys';
import { dateToDateTime, prisma } from '../common/database';
import { generateId } from '../common/flakeId';
import { removeDuplicates } from '../common/utils';
import { hasBit, USER_BADGES } from '../common/Bitwise';
import { addDeviceWithSession } from '@src/services/User/UserManagement';

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
export type ActivityStatusWithoutSocketId = Omit<ActivityStatus, 'socketId'> & { socketId?: undefined };
export interface Presence {
  userId: string;
  status: number;
  custom?: string | null;
  activities?: ActivityStatus[] | null;
}
export type PresenceWithoutActivityStatusSocketId = Omit<Presence, 'activities'> & { activities?: ActivityStatusWithoutSocketId[] | null };

interface GetUserPresencesOpts {
  userIds: string[];
  includeSocketId?: boolean; // default false
  hideOffline?: boolean; // default true
  limitActivities?: boolean;
}

export async function getUserPresences(opts: GetUserPresencesOpts): Promise<Presence[]> {
  const userIds = opts.userIds;
  const includeSocketId = opts.includeSocketId === undefined ? false : opts.includeSocketId;
  const hideOffline = opts.hideOffline === undefined ? true : opts.hideOffline;
  const limitActivities = opts.limitActivities === undefined ? true : opts.limitActivities;

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
    const presence = JSON.parse(result) as Presence;
    if (hideOffline && presence.status === UserStatus.OFFLINE) continue;
    if (!includeSocketId) {
      presence.activities = presence.activities?.map((a) => ({ ...a, socketId: undefined })) as ActivityStatus[] | undefined;
    }
    presence.activities = limitActivities ? presence.activities?.slice(0, 5) : presence.activities;
    presences.push(presence);
  }

  return presences;
}
interface UpdateCachePresenceOpts {
  userId: string;
  socketId?: string;
  presence: Partial<Presence> & {
    userId: string;
  };
}
export async function updateCachePresence({ userId, socketId, presence }: UpdateCachePresenceOpts) {
  const key = USER_PRESENCE_KEY_STRING(userId);
  const socketIdsKey = CONNECTED_SOCKET_ID_KEY_SET(userId);

  const connectedCount = await redisClient.sCard(socketIdsKey);

  if (connectedCount === 0) return { shouldEmit: false } as const;

  const currentStatus = await getUserPresences({ userIds: [userId], includeSocketId: true, hideOffline: false, limitActivities: false });

  const isOffline = !currentStatus?.[0]?.status && !presence.status;

  if (presence.custom === null) presence.custom = undefined;

  if (presence.activities || presence.activities === null) {
    const newActivities = [...(presence.activities || [])];
    presence.activities =
      currentStatus[0]?.activities?.filter((activity) => {
        return activity.socketId !== socketId;
      }) || [];
    presence.activities.push(...(newActivities || []));
  }

  const newPresence = { ...currentStatus[0], ...presence };

  await redisClient.set(key, JSON.stringify(newPresence));

  return { shouldEmit: !isOffline, presence: newPresence } as const;
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
}
export interface ApplicationCache {
  id: string;
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

const LUA_SESSION_FETCH = `
    local userId = redis.call("GET", KEYS[1])
    if userId then
      local userCacheKey = ARGV[1] .. userId
      return redis.call("GET", userCacheKey)
    end
    return nil
  `;

export async function getUserCacheBySessionId(sessionId: string, beforeCache?: (user: UserCache) => Promise<{ type?: string; message: string; data?: any } | undefined>) {
  const sessionToUserIdKey = SESSION_ID_TO_USER_ID(sessionId);
  const userCachePrefix = USER_CACHE_KEY_STRING('');

  const cacheUser = await redisClient.eval(LUA_SESSION_FETCH, {
    keys: [sessionToUserIdKey],
    arguments: [userCachePrefix],
  });

  if (typeof cacheUser === 'string') {
    return [JSON.parse(cacheUser) as UserCache, null] as const;
  }
  // If not in cache, fetch from database

  const device = await prisma.userDevice.findFirst({ where: { sessionId }, select: { userId: true } });
  if (!device) return [null, null] as const;

  await redisClient.set(sessionToUserIdKey, device.userId, { EX: 3600 }); // 1 hour

  return storeUserCache(device.userId, beforeCache);
}

export async function getUserCache(userId: string, beforeCache?: (user: UserCache) => Promise<{ type?: string; message: string; data?: any } | undefined>) {
  // First, check in cache
  const cacheKey = USER_CACHE_KEY_STRING(userId);
  const cacheUser = await redisClient.get(cacheKey);
  if (cacheUser) {
    return [JSON.parse(cacheUser) as UserCache, null] as const;
  }
  // If not in cache, fetch from database
  return storeUserCache(userId, beforeCache);
}

async function storeUserCache(userId: string, beforeCache?: (user: UserCache) => Promise<{ type?: string; message: string; data?: any } | undefined>) {
  const cacheKey = USER_CACHE_KEY_STRING(userId);

  const user = await getUserWithAccount(userId);
  if (!user) return [null, null] as const;

  if (!user.application && !user.account) return [null, null] as const;

  const userCache: UserCache = {
    ...(user.account
      ? {
          account: {
            id: user.account!.id,
            emailConfirmed: user.account!.emailConfirmed,
          },
        }
      : {
          application: {
            id: user.application!.id,
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
    if (error) return [null, error] as const;
  }

  // Save to cache
  await redisClient.set(cacheKey, JSON.stringify(userCache));

  return [userCache, null] as const;
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

export async function authenticateUser(token: string, ipAddress: string) {
  const decryptedToken = decryptToken(token);
  if (!decryptedToken) {
    return [null, { message: 'Invalid token.' }, null] as const;
  }

  const sessionIdOrUserId = decryptedToken.userId;

  let [userCache, error] = await getUserCacheBySessionId(sessionIdOrUserId!, beforeAuthenticateCache);
  let newToken: string | null = null;

  // remove this code after 30 days.
  // only used for migration.
  if (!userCache) {
    const secondRes = await getUserCache(sessionIdOrUserId, beforeAuthenticateCache);
    userCache = secondRes[0];
    error = secondRes[1];

    if (userCache) {
      if (userCache.bot) {
        return [null, { message: 'Token system has been updated. Please Regenerate new bot token.' }, null] as const;
      }

      const sessionId = generateId();
      await addDeviceWithSession(userCache.id, sessionId, ipAddress);
      newToken = generateToken(sessionId, 1);
    }
  }
  //

  if (error) {
    return [null, error, null] as const;
  }

  if (!userCache) {
    return [null, { message: 'Invalid token.' }, null] as const;
  }

  const isIpAllowed = await isIPAllowedCache(ipAddress);

  const isFounder = hasBit(userCache.badges, USER_BADGES.FOUNDER.bit);

  if (!isIpAllowed || userCache.ip !== ipAddress) {
    const ipBanned = await isIpBanned(ipAddress);
    if (!newToken) {
      await addDeviceWithSession(userCache.id, sessionIdOrUserId, ipAddress);
    }

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
        null,
      ] as const;
    }
    await addAllowedIPCache(ipAddress);
    await updateUserCache(userCache.id, { ip: ipAddress });
  }

  return [userCache, null, newToken] as const;
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

export async function addGoogleDriveAccessTokenCache(userId: string, accessToken: string) {
  const key = GOOGLE_DRIVE_ACCESS_TOKEN(userId);
  const multi = redisClient.multi();
  multi.set(key, accessToken);
  multi.expire(key, 3000);
  return await multi.exec();
}

export async function removeGoogleDriveAccessTokenCache(userId: string) {
  const key = GOOGLE_DRIVE_ACCESS_TOKEN(userId);
  await redisClient.del(key);
}

export async function getGoogleDriveAccessTokenCache(userId: string) {
  const key = GOOGLE_DRIVE_ACCESS_TOKEN(userId);
  const result = await redisClient.get(key);
  if (!result) return null;
  return result;
}

export async function removeSessions(sessionIds: string[]) {
  await redisClient.del(sessionIds.map((id) => SESSION_ID_TO_USER_ID(id)));
}
