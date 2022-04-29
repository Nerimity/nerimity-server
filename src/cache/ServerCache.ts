import { redisClient } from '../common/redis';
import { ServerModel } from '../models/ServerModel';
import { SERVER_KEY_STRING } from './CacheKeys';

export interface ServerCache {
  _id: string
  name: string,
}

export const getServerCache = async (serverId: string) => {
  const key = SERVER_KEY_STRING(serverId);
  const serverString = await redisClient.get(key);
  if (serverString) return JSON.parse(serverString);

  const server = await ServerModel.findOne({ _id: serverId }).select('-__v');
  if (!server) return null;

  const serverCache = {
    name: server.name,
    _id: server.id,
  };
  await redisClient.set(key, JSON.stringify(serverCache));
  return serverCache;
};