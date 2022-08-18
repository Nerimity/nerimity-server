import { prisma } from '../common/database';
import { redisClient } from '../common/redis';
import { SERVER_KEY_STRING } from './CacheKeys';

export interface ServerCache {
  id: string
  name: string,
  createdById: string,
}

export const getServerCache = async (serverId: string) => {
  const key = SERVER_KEY_STRING(serverId);
  const serverString = await redisClient.get(key);
  if (serverString) return JSON.parse(serverString);

  const server = await prisma.server.findFirst({where: {id: serverId }});
  if (!server) return null;

  const serverCache: ServerCache = {
    name: server.name,
    id: server.id,
    createdById: server.createdById,
  };
  const serverCacheString = JSON.stringify(serverCache);
  await redisClient.set(key, serverCacheString);
  return JSON.parse(serverCacheString);
};