import { Prisma, PublicServer, Server } from '@prisma/client';
import { CustomResult } from '../common/CustomResult';
import { dateToDateTime, prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { joinServer } from './Server';
import { updateServerCache } from '../cache/ServerCache';
import { createMessage } from './Message';
import { MessageType } from '../types/Message';

interface getPublicServersOpts {
  sort?: 'most_bumps' | 'most_members' | 'recently_added' | 'recently_bumped';
  filter?: 'all' | 'verified';
  limit?: number;
  afterId?: string;
  search?: string;
}
export const getPublicServers = async (opts: getPublicServersOpts): Promise<PublicServer[]> => {
  const { sort, filter, limit, search } = opts;
  const where = (): Prisma.PublicServerWhereInput => {
    if (filter === 'verified') return { server: { verified: true } };
    return {};
  };

  const orderBy = (): Prisma.Enumerable<Prisma.PublicServerOrderByWithRelationInput> => {
    if (sort === 'most_bumps') return { bumpCount: 'desc' };
    if (sort === 'most_members') return { server: { serverMembers: { _count: 'desc' } } };
    if (sort === 'recently_added') return { createdAt: 'desc' };
    if (sort === 'recently_bumped') return { bumpedAt: 'desc' };
    return {};
  };

  const publicServers = await prisma.publicServer.findMany({
    where: { AND: [where(), { server: { scheduledForDeletion: null } }], ...(search?.trim() ? { OR: [{ server: { name: { contains: search, mode: 'insensitive' } } }, { description: { contains: search, mode: 'insensitive' } }] } : {}) },
    orderBy: orderBy(),
    ...(opts.afterId ? { cursor: { id: opts.afterId }, skip: 1 } : {}),
    include: {
      server: { include: { _count: { select: { serverMembers: true } } } },
    },
    ...(limit ? { take: limit } : {}),
  });

  return publicServers;
};

export const getPublicServer = async (serverId: string): Promise<CustomResult<PublicServer, CustomError>> => {
  const publicServer = await prisma.publicServer.findFirst({
    where: { serverId },
    include: {
      server: { include: { _count: { select: { serverMembers: true } } } },
    },
  });

  if (!publicServer) {
    return [null, generateError('Server not found.')];
  }

  return [publicServer, null];
};

export const bumpPublicServer = async (serverId: string, bumpedByUserId: string): Promise<CustomResult<PublicServer, CustomError>> => {
  const publicServer = await prisma.publicServer.findUnique({
    where: { serverId, server: { scheduledForDeletion: null } },
    include: {
      server: {
        select: {
          systemChannelId: true,
        },
      },
    },
  });

  if (!publicServer) {
    return [null, generateError('Server not found.')];
  }

  const lastBumped = publicServer.bumpedAt;
  const now = new Date();

  // if the server was bumped less than 12 hours, return error
  if (lastBumped && now.getTime() - lastBumped.getTime() < 3 * 60 * 60 * 1000) {
    return [null, generateError('Server was bumped too recently.')];
  }

  const newPublicServer = await prisma.publicServer.update({
    where: { id: publicServer.id },
    data: {
      bumpCount: { increment: 1 },
      lifetimeBumpCount: { increment: 1 },
      bumpedAt: dateToDateTime(),
    },
    include: {
      server: { include: { _count: { select: { serverMembers: true } } } },
    },
  });

  if (publicServer.server.systemChannelId) {
    await createMessage({
      channelId: publicServer.server.systemChannelId,
      type: MessageType.BUMP_SERVER,
      userId: bumpedByUserId,
      serverId,
    });
  }

  return [newPublicServer, null];
};

export const updatePublicServer = async (serverId: string, description: string): Promise<CustomResult<PublicServer, CustomError>> => {
  const publicServer = await prisma.publicServer.upsert({
    where: {
      serverId,
    },
    create: {
      id: generateId(),
      serverId,
      description,
      bumpCount: 1,
    },
    update: {
      description,
    },
  });
  await updateServerCache(serverId, { public: true });

  return [publicServer, null];
};

export const deletePublicServer = async (serverId: string): Promise<CustomResult<PublicServer, CustomError>> => {
  const publicServer = await prisma.publicServer.delete({
    where: { serverId },
  });
  await updateServerCache(serverId, { public: false });
  return [publicServer, null];
};

export const joinPublicServer = async (userId: string, serverId: string): Promise<CustomResult<Server, CustomError>> => {
  const publicServer = await prisma.publicServer.findFirst({
    where: { serverId },
  });
  if (!publicServer) {
    return [null, generateError('Server is not public.')];
  }

  return await joinServer(userId, serverId);
};
