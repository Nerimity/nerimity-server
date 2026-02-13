import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { addBit } from '../common/Bitwise';
import { redisClient } from '../common/redis';
import { SERVER_MEMBERS_KEY_HASH } from './CacheKeys';

export interface ServerMemberCache {
  id: string;
  userId: string;
  permissions: number;
  topRoleOrder: number;
  muteExpireAt?: number;
}

export const getServerMemberCache = async (serverId: string, userId: string): Promise<CustomResult<ServerMemberCache, string>> => {
  const key = SERVER_MEMBERS_KEY_HASH(serverId);

  let stringifiedMember = await redisClient.hGet(key, userId);

  if (stringifiedMember) {
    return [JSON.parse(stringifiedMember), null];
  }

  // fetch from database and cache it.
  const serverMember = await prisma.serverMember.findUnique({
    where: { userId_serverId: { serverId, userId } },
    include: { server: { select: { defaultRoleId: true } } },
  });

  if (!serverMember) return [null, 'Server member is not in this server.'];

  // get member permissions
  let permissions = 0;
  serverMember.roleIds.push(serverMember.server.defaultRoleId);
  const roles = await prisma.serverRole.findMany({
    where: { id: { in: serverMember.roleIds } },
    select: { permissions: true, order: true },
    orderBy: { order: 'desc' },
  });

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    permissions = addBit(permissions, role.permissions);
  }

  stringifiedMember = JSON.stringify({
    id: serverMember.id,
    userId: serverMember.userId,
    permissions,
    topRoleOrder: roles[0].order,
    muteExpireAt: serverMember.muteExpireAt as unknown as number,
  } as ServerMemberCache);
  await redisClient.hSet(key, userId, stringifiedMember);
  return [JSON.parse(stringifiedMember), null];
};

export const deleteServerMemberCache = (serverId: string, userId: string) => {
  const key = SERVER_MEMBERS_KEY_HASH(serverId);
  return redisClient.hDel(key, userId);
};

export const deleteAllServerMemberCache = (serverId: string) => {
  const key = SERVER_MEMBERS_KEY_HASH(serverId);
  return redisClient.del(key);
};

export const getServerMembersCache = async (serverId: string): Promise<ServerMemberCache[]> => {
  const key = SERVER_MEMBERS_KEY_HASH(serverId);

  const members = await redisClient.hGetAll(key);

  const array = Object.values(members);

  return array.map((member) => JSON.parse(member));
};
