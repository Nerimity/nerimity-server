import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { redisClient } from '../common/redis';
import { SERVER_MEMBERS_KEY_HASH } from './CacheKeys';

export interface ServerMemberCache {
  permissions: number,
  userId: string;
}

export const getServerMemberCache = async (serverId: string, userId: string): Promise<CustomResult<ServerMemberCache, string>> => {
  const key = SERVER_MEMBERS_KEY_HASH(serverId);

  let stringifiedMember = await redisClient.hGet(key, userId);

  if (stringifiedMember) {
    return [JSON.parse(stringifiedMember), null];
  }

  // fetch from database and cache it.
  const serverMember = await prisma.serverMember.findFirst({where: {userId: userId, serverId: serverId}});

  if (!serverMember) return [null, 'Server member is not in this server.'];

  stringifiedMember = JSON.stringify(serverMember);
  await redisClient.hSet(key, userId, stringifiedMember);
  return [JSON.parse(stringifiedMember), null];
};


export const getServerMembersCache = async (serverId: string): Promise<ServerMemberCache[]> => {
  const key = SERVER_MEMBERS_KEY_HASH(serverId);

  const members = await redisClient.hGetAll(key);

  const array = Object.values(members);

  return array.map(member => JSON.parse(member));
  
};