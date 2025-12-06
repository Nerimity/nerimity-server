import { Prisma, Explore, Server } from '@src/generated/prisma/client';
import { CustomResult } from '../common/CustomResult';
import { dateToDateTime, prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { joinServer } from './Server';
import { updateServerCache } from '../cache/ServerCache';
import { createMessage } from './Message/Message';
import { MessageType } from '../types/Message';
import { ExploreOrderByWithRelationInput, ExploreWhereInput } from '@src/generated/prisma/models';
import { getUserPresences } from '@src/cache/UserCache';
import { getHourStart } from '@src/common/utils';

export enum ExploreType {
  SERVER = 0,
  BOT = 1,
}

const mostActivePublicServers = async (opts: { limit: number; skip: number; search?: string; filter: ExploreWhereInput }) => {
  const daysToLookBack = 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysToLookBack);
  const queryStart = getHourStart(startDate);

  const results = await prisma.serverHourlyMessageCount.groupBy({
    by: ['serverId'],
    take: opts.limit,
    skip: opts.skip,

    where: {
      server: {
        scheduledForDeletion: null,
        ...(opts.search?.trim() ? { OR: [{ name: { contains: opts.search, mode: 'insensitive' } }, { publicServer: { description: { contains: opts.search, mode: 'insensitive' } } }] } : {}),
        publicServer: {
          ...(Object.keys(opts.filter).length ? opts.filter : { isNot: null }),
        },
      },
      hourStart: {
        gte: queryStart,
      },
    },
    orderBy: {
      _sum: {
        userMessageCount: 'desc',
      },
    },
  });

  const serverIds = results.map((result) => result.serverId);

  const publicServers = await prisma.explore.findMany({
    where: {
      id: {
        in: serverIds,
      },
    },
    include: {
      server: { include: { createdBy: { select: { id: true, username: true, tag: true } }, _count: { select: { serverMembers: true } } } },
    },
  });

  const serverRank = new Map<string, number>();
  serverIds.forEach((id, index) => {
    serverRank.set(id, index);
  });

  return publicServers.sort((a, b) => {
    return serverRank.get(a.id)! - serverRank.get(b.id)!;
  });
};

interface getExploreItemsOpts {
  sort?: 'pinned_at' | 'most_bumps' | 'most_members' | 'recently_added' | 'recently_bumped' | 'most_active';
  filter?: 'pinned' | 'all' | 'verified';
  limit?: number;
  afterId?: string;
  search?: string;
  type?: 'server' | 'bot';
}
export const getExploreItems = async (opts: getExploreItemsOpts): Promise<Explore[]> => {
  const { sort, filter, limit, search } = opts;
  const where = (): ExploreWhereInput => {
    let where: ExploreWhereInput = {};
    if (filter === 'verified') where = { server: { verified: true } };
    if (filter === 'pinned') where = { pinnedAt: { not: null } };
    if (opts.type === 'bot') where.type = ExploreType.BOT;
    else where.type = ExploreType.SERVER;
    return where;
  };

  if (sort === 'most_active') {
    return await mostActivePublicServers({ limit: limit!, skip: opts.afterId ? parseInt(opts.afterId) : 0, search, filter: where() });
  }

  const orderBy = (): Prisma.Enumerable<ExploreOrderByWithRelationInput> => {
    if (sort === 'most_bumps') return { bumpCount: 'desc' };
    if (sort === 'most_members') {
      if (opts.type === 'bot') {
        return { botApplication: { botUser: { servers: { _count: 'desc' } } } };
      }
      return { server: { serverMembers: { _count: 'desc' } } };
    }
    if (sort === 'recently_added') return { createdAt: 'desc' };
    if (sort === 'recently_bumped') return { bumpedAt: 'desc' };
    if (sort === 'pinned_at') return { pinnedAt: 'asc' };
    return {};
  };

  const publicServers = await prisma.explore.findMany({
    where: {
      AND: [where(), opts.type === 'server' ? { server: { scheduledForDeletion: null } } : {}],
      ...(search?.trim() ? { OR: [{ botApplication: { botUser: { username: { contains: search, mode: 'insensitive' } } } }, { server: { name: { contains: search, mode: 'insensitive' } } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
    },
    orderBy: orderBy(),
    ...(opts.afterId ? { cursor: { id: opts.afterId }, skip: 1 } : {}),
    include: {
      server: { include: { createdBy: { select: { id: true, username: true, tag: true } }, _count: { select: { serverMembers: true } } } },
      botApplication: {
        select: {
          id: true,
          botUser: { select: { _count: { select: { servers: true } }, banner: true, id: true, username: true, tag: true, avatar: true, hexColor: true, badges: true } },
          creatorAccount: {
            select: { user: { select: { id: true, username: true, tag: true } } },
          },
        },
      },
    },
    ...(limit ? { take: limit } : {}),
  });

  if (opts.type === 'bot') {
    const botUserIds = publicServers.map((item) => item.botApplication?.botUser?.id).filter((id) => id) as string[];
    if (botUserIds.length) {
      const onlineBots = await getUserPresences(botUserIds, true, true);
      return publicServers.map((item) => ({
        ...item,
        botApplication: {
          ...item.botApplication,
          botUser: {
            ...item.botApplication?.botUser,
            online: !!onlineBots.find((bot) => bot.userId === item.botApplication?.botUser?.id),
          },
        },
      }));
    }
  }

  return publicServers;
};

interface GetExploreItemOpts {
  serverId?: string;
  botApplicationId?: string;
}

export const getExploreItem = async (opts: GetExploreItemOpts) => {
  const publicItem = await prisma.explore.findUnique({
    where: opts.serverId ? { serverId: opts.serverId } : { botApplicationId: opts.botApplicationId },
    include: {
      server: { include: { _count: { select: { serverMembers: true } } } },
      botApplication: {
        select: {
          botUser: { select: { _count: { select: { servers: true } }, banner: true, id: true, username: true, tag: true, avatar: true, hexColor: true, badges: true } },
          creatorAccount: {
            select: { user: { select: { id: true, username: true, tag: true } } },
          },
        },
      },
    },
  });

  if (!publicItem) {
    return [null, generateError(`${opts.serverId ? 'Server' : 'Bot'} not found.`)] as const;
  }

  return [publicItem, null] as const;
};

interface BumpExploreItemOpts {
  exploreId: string;
  bumpedByUserId: string;
}

export const bumpExploreItem = async (opts: BumpExploreItemOpts) => {
  const exploreItem = await prisma.explore.findUnique({
    where: { id: opts.exploreId },
    include: {
      server: {
        select: {
          systemChannelId: true,
        },
      },
    },
  });

  if (!exploreItem) {
    return [null, generateError(`Item not found.`)] as const;
  }

  if (exploreItem.botApplicationId) {
    const botUser = await prisma.application.findUnique({ where: { id: exploreItem.botApplicationId }, select: { botUserId: true } });
    if (!botUser?.botUserId) {
      return [null, generateError(`Bot not found.`)] as const;
    }
    const presences = await getUserPresences([botUser.botUserId], true, true);
    if (!presences.length) {
      return [null, generateError(`Bot is offline.`)] as const;
    }
  }

  const lastBumped = exploreItem.bumpedAt;
  const now = new Date();

  // if the server was bumped less than 12 hours, return error
  if (lastBumped && now.getTime() - lastBumped.getTime() < 3 * 60 * 60 * 1000) {
    return [null, generateError('Server was bumped too recently.')] as const;
  }

  const newExploreItem = await prisma.explore.update({
    where: { id: exploreItem.id },
    data: {
      bumpCount: { increment: 1 },
      lifetimeBumpCount: { increment: 1 },
      bumpedAt: dateToDateTime(),
    },
    include: {
      server: { include: { _count: { select: { serverMembers: true } } } },
    },
  });

  if (exploreItem.server?.systemChannelId) {
    await createMessage({
      channelId: exploreItem.server.systemChannelId,
      type: MessageType.BUMP_SERVER,
      userId: opts.bumpedByUserId,
      serverId: exploreItem.serverId!,
    });
  }

  return [newExploreItem, null] as const;
};

interface UpsertExploreItemOpts {
  serverId?: string;
  botApplicationId?: string;
  botPermissions?: number;
  description: string;
  updatedByAccountId?: string;
}

export const upsertExploreItem = async (opts: UpsertExploreItemOpts): Promise<CustomResult<Explore, CustomError>> => {
  if (opts.botApplicationId) {
    if (!opts.updatedByAccountId) {
      return [null, generateError('Bot application not found.')] as const;
    }
    const botApplication = await prisma.application.findUnique({ where: { id: opts.botApplicationId, creatorAccountId: opts.updatedByAccountId }, select: { botUserId: true } });
    if (!botApplication) {
      return [null, generateError('This bot does not belong to you.')] as const;
    }
    if (!botApplication.botUserId) {
      return [null, generateError('Bot application not found.')] as const;
    }
  }
  if (opts.serverId && opts.botPermissions) {
    return [null, generateError('Cannot specify both serverId and botPermissions.')] as const;
  }

  const exploreItem = await prisma.explore.upsert({
    where: {
      ...(opts.serverId ? { serverId: opts.serverId } : { botApplicationId: opts.botApplicationId }),
    },
    create: {
      id: generateId(),
      ...(opts.serverId ? { serverId: opts.serverId } : { botApplicationId: opts.botApplicationId }),
      description: opts.description,
      bumpCount: 1,
      type: opts.serverId ? ExploreType.SERVER : ExploreType.BOT,
      ...(opts.botPermissions !== undefined ? { botPermissions: opts.botPermissions } : undefined),
    },
    update: {
      description: opts.description,
      ...(opts.botPermissions !== undefined ? { botPermissions: opts.botPermissions } : undefined),
    },
  });
  if (opts.serverId) {
    await updateServerCache(opts.serverId, { public: true });
  }

  return [exploreItem, null] as const;
};

interface DeleteExploreItemOpts {
  exploreId: string;
  requesterUserId?: string;
}

export const deleteExploreItem = async (opts: DeleteExploreItemOpts) => {
  const exploreItem = await prisma.explore.findUnique({
    where: { id: opts.exploreId },
    select: { server: { select: { id: true, createdById: true } }, type: true, botApplication: { select: { creatorAccount: { select: { userId: true } } } } },
  });

  if (!exploreItem) {
    return [null, generateError(`Item not found.`)] as const;
  }

  if (exploreItem.type === ExploreType.BOT && exploreItem.botApplication?.creatorAccount.userId !== opts.requesterUserId) {
    return [null, generateError('You do not have permission to delete this explore item.')] as const;
  }
  if (exploreItem.type === ExploreType.SERVER && opts.requesterUserId !== exploreItem.server?.createdById) {
    return [null, generateError('You do not have permission to delete this explore item.')] as const;
  }

  await prisma.explore.delete({
    where: { id: opts.exploreId },
  });

  if (exploreItem.server?.id) {
    await updateServerCache(exploreItem.server.id, { public: false });
  }

  return [true, null] as const;
};

export const joinPublicServer = async (userId: string, serverId: string): Promise<CustomResult<Server, CustomError>> => {
  const publicServer = await prisma.explore.findUnique({
    where: { serverId },
  });
  if (!publicServer) {
    return [null, generateError('Server is not public.')];
  }

  return await joinServer(userId, serverId);
};
