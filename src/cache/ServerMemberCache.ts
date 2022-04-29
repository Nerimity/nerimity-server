import { CustomResult } from '../common/CustomResult';
import { redisClient } from '../common/redis';
import { ServerMemberModel } from '../models/ServerMemberModel';
import { SERVER_MEMBERS_KEY_HASH } from './CacheKeys';

export interface ServerMemberCache {
  permissions: number,
}

export const getServerMemberCache = async (serverId: string, userId: string): Promise<CustomResult<ServerMemberCache, string>> => {
  const key = SERVER_MEMBERS_KEY_HASH(serverId);

  let stringifiedMember = await redisClient.hGet(key, userId);

  if (stringifiedMember) {
    return [JSON.parse(stringifiedMember), null];
  }

  // fetch from database and cache it.
  const serverMember = await ServerMemberModel.findOne({user: userId, server: serverId}).select('-__v');

  if (!serverMember) return [null, 'Server member is not in this server.'];

  stringifiedMember = JSON.stringify(serverMember);
  await redisClient.hSet(key, userId, stringifiedMember);
  return [JSON.parse(stringifiedMember), null];


};