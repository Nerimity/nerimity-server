import { prisma } from '../common/database';
import { redisClient } from '../common/redis';
import { SERVER_KEY_STRING } from './CacheKeys';

export interface ServerCache {
  id: string;
  name: string;
  createdById: string;
  avatar?: string | null;
  hexColor: string;
  defaultRoleId: string;
  public: boolean;
}

export const getServerCache = async (serverId: string) => {
  const key = SERVER_KEY_STRING(serverId);
  const serverString = await redisClient.get(key);
  if (serverString) return JSON.parse(serverString);

  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: { PublicServer: true },
  });
  if (!server) return null;

  const serverCache: ServerCache = {
    name: server.name,
    id: server.id,
    createdById: server.createdById,
    avatar: server.avatar,
    hexColor: server.hexColor,
    defaultRoleId: server.defaultRoleId,
    public: server.PublicServer ? true : false,
  };
  const serverCacheString = JSON.stringify(serverCache);
  await redisClient.set(key, serverCacheString);
  return JSON.parse(serverCacheString);
};

export const deleteServerCache = async (serverId: string) => {
  const key = SERVER_KEY_STRING(serverId);
  await redisClient.del(key);
};

export const updateServerCache = async (
  serverId: string,
  update: Partial<ServerCache>
) => {
  const key = SERVER_KEY_STRING(serverId);
  const cache = await getServerCache(serverId);
  if (!cache) return;
  await redisClient.set(key, JSON.stringify({ ...cache, ...update }));
};
