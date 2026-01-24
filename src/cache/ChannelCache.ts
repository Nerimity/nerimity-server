import { Account, Inbox, User } from '@src/generated/prisma/client';
import { addBit, CHANNEL_PERMISSIONS, hasBit } from '../common/Bitwise';
import { prisma } from '../common/database';
import { redisClient } from '../common/redis';
import { TicketStatus } from '../services/Ticket';
import { DmStatus } from '../services/User/User';
import { ChannelType } from '../types/Channel';
import { FriendStatus } from '../types/Friend';
import { DM_CHANNEL_KEY_STRING, INBOX_KEY_STRING, SERVER_CHANNEL_KEY_STRING, SERVER_CHANNEL_PERMISSION_KEY_HASH, TICKET_CHANNEL_KEY_STRING } from './CacheKeys';
import { getServerCache, ServerCache } from './ServerCache';

export interface ServerChannelCache {
  name: string;
  serverId: string;
  permissions: number;
  type: ChannelType.SERVER_TEXT | ChannelType.CATEGORY;
  server: ServerCache;
  slowModeSeconds?: number;
  canBePublic?: boolean; // Check if a channel can be public. (Using Customize page.)
}

export interface DMChannelCache {
  inbox: InboxCache;
  type: ChannelType.DM_TEXT;
}

export interface TicketChannelCache {
  name: string;
  type: ChannelType.TICKET;
  ticket: {
    id: number;
    status: TicketStatus;
  };
}

export interface BaseChannelCache {
  id: string;
  createdById: string;
}

export type ChannelCache = BaseChannelCache & (ServerChannelCache | DMChannelCache | TicketChannelCache);

type CanMessageError = 'BLOCKED_BY_REQUESTER' | 'BLOCKED_BY_RECIPIENT' | 'NOT_FRIENDS_REQUESTER' | 'NOT_FRIENDS_RECIPIENT' | 'NOT_FRIENDS_AND_SERVERS_REQUESTER' | 'NOT_FRIENDS_AND_SERVERS_RECIPIENT' | 'UNKNOWN';

export interface InboxCache {
  recipientId: string;
  createdById: string;
  canMessage: boolean;
  canMessageError: CanMessageError | null;
  recipient: { bot: boolean | null };
}

const setServerChannelMemberPermissions = async (serverId: string, channelId: string, userId: string) => {
  const key = SERVER_CHANNEL_PERMISSION_KEY_HASH(channelId);

  const member = await prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        serverId,
        userId,
      },
    },
    select: { roleIds: true, server: { select: { defaultRoleId: true } } },
  });
  if (!member) {
    return [null, 'Member not found.'] as const;
  }

  const channel = await prisma.channel.findUnique({
    where: {
      id: channelId,
    },
    select: {
      permissions: {
        select: {
          roleId: true,
          permissions: true,
        },
      },
    },
  });
  if (!channel) {
    return [null, 'Channel not found.'] as const;
  }

  member.roleIds.push(member.server.defaultRoleId);

  // const rolePermissions = channel.permissions.filter((p) => member.roleIds.includes(p.roleId));

  let permissions = 0;

  for (let i = 0; i < channel.permissions.length; i++) {
    const rolePermission = channel.permissions[i]!;
    if (!member.roleIds.includes(rolePermission?.roleId)) continue;
    permissions = addBit(permissions, rolePermission.permissions || 0);
  }

  redisClient.hset(key, userId, permissions.toString());

  return [permissions, null] as const;
};

export const removeServerMemberPermissionsCache = async (channelIds: string[], userIds?: string[]) => {
  const multi = redisClient.pipeline();

  for (let i = 0; i < channelIds.length; i++) {
    const channelId = channelIds[i]!;
    const key = SERVER_CHANNEL_PERMISSION_KEY_HASH(channelId);

    if (userIds) {
      multi.hdel(key, ...userIds);
      continue;
    }

    multi.del(key);
  }

  await multi.exec();
};

const getServerChannelMemberPermissions = async (serverId: string, channelId: string, userId: string) => {
  const key = SERVER_CHANNEL_PERMISSION_KEY_HASH(channelId);

  const cachedPermissions = await redisClient.hget(key, userId);
  if (cachedPermissions) {
    return [Number(cachedPermissions), null] as const;
  }

  return setServerChannelMemberPermissions(serverId, channelId, userId);
};

export const getChannelForUserCache = async (channelId: string, userId?: string) => {
  // Check server channel in cache.
  const serverChannel = await getServerChannelCache(channelId);
  if (serverChannel) {
    const server = await getServerCache(serverChannel.serverId as string);
    const [permissions, error] = !userId ? [0, null] : await getServerChannelMemberPermissions(serverChannel.serverId as string, channelId, userId);
    if (error) return [null, error] as const;

    return [{ ...serverChannel, server, permissions } as ChannelCache, null] as const;
  }

  // Check DM channel in cache.
  const dmChannel = await getDMChannelCache(channelId);
  if (dmChannel) {
    if (!userId) return [null, 'User not found.'] as const;
    const inbox = await getInboxCache(channelId, userId);
    if (!inbox) return [null, 'Inbox not found.'] as const;
    return [{ ...dmChannel, inbox } as ChannelCache, null] as const;
  }

  // Check ticket channel in cache.
  const ticketChannel = await getTicketChannelCache(channelId);
  if (ticketChannel) {
    return [ticketChannel as ChannelCache, null] as const;
  }

  return await addChannelToCache(channelId, userId);
};

const addChannelToCache = async (channelId: string, userId?: string) => {
  // If not in cache, fetch from database.
  const channel = await prisma.channel.findUnique({
    where: { id: channelId, deleting: null },
    include: {
      permissions: { select: { permissions: true, roleId: true } },
      ticket: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!channel) return [null, 'Channel does not exist.'] as const;

  if (channel.serverId) {
    const server = await getServerCache(channel.serverId);
    if (!server) return [null, 'Server does not exist.'] as const;

    const defaultRoleId = server?.defaultRoleId;
    const defaultPerm = channel.permissions.find((p) => p.roleId === defaultRoleId);
    const isPublicChannel = hasBit(defaultPerm?.permissions || 0, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);
    let canBePublic = false;
    if (isPublicChannel) {
      canBePublic = true;
    }
    if (!canBePublic) {
      const publicChannelPermRoleIds = channel?.permissions.filter((p) => hasBit(p.permissions || 0, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit)).map((p) => p.roleId);
      if (publicChannelPermRoleIds.length) {
        const question = await prisma.serverWelcomeQuestion.findFirst({
          where: { serverId: server.id, answers: { some: { roleIds: { hasSome: publicChannelPermRoleIds } } } },
          select: { id: true },
        });
        if (question) canBePublic = true;
      }
    }

    const stringifiedChannel = JSON.stringify({ ...channel, canBePublic });
    await redisClient.set(SERVER_CHANNEL_KEY_STRING(channelId), stringifiedChannel);

    const [permissions, error] = !userId ? [0, null] : await getServerChannelMemberPermissions(channel.serverId as string, channelId, userId);
    if (error) return [null, error] as const;

    return [
      {
        ...JSON.parse(stringifiedChannel),
        server,
        permissions,
      } as ChannelCache,
      null,
    ] as const;
  }

  const stringifiedChannel = JSON.stringify(channel);

  if (channel.type === ChannelType.DM_TEXT) {
    const inbox = await getInboxCache(channelId, userId);
    return [{ ...JSON.parse(stringifiedChannel), inbox } as ChannelCache, null] as const;
  }

  if (channel.type === ChannelType.TICKET) {
    await redisClient.set(TICKET_CHANNEL_KEY_STRING(channelId), stringifiedChannel);
    return [JSON.parse(stringifiedChannel) as ChannelCache, null] as const;
  }
  return [null, 'Unknown channel type.'] as const;
};

export const updateTicketChannelStatus = async (channelId: string, status: TicketStatus) => {
  const channel = await getTicketChannelCache(channelId);
  if (!channel) return;

  channel.ticket.status = status;

  await redisClient.set(TICKET_CHANNEL_KEY_STRING(channelId), JSON.stringify(channel));
};

const getDMChannelCache = async (channelId: string) => {
  const channel = await redisClient.get(DM_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel) as BaseChannelCache & DMChannelCache;
};
const getTicketChannelCache = async (channelId: string) => {
  const channel = await redisClient.get(TICKET_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel) as BaseChannelCache & TicketChannelCache;
};

const getServerChannelCache = async (channelId: string) => {
  const channel = await redisClient.get(SERVER_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel) as BaseChannelCache & ServerChannelCache;
};

export const updateServerChannelCache = async (channelId: string, update: Partial<ChannelCache>) => {
  const cache = await getServerChannelCache(channelId);
  if (!cache) return;
  await redisClient.set(SERVER_CHANNEL_KEY_STRING(channelId), JSON.stringify({ ...cache, ...update }));
};

export const deleteServerChannelCaches = async (channelIds: string[], alsoDeletePermissions = true) => {
  const multi = redisClient.pipeline();
  for (let i = 0; i < channelIds.length; i++) {
    const channelId = channelIds[i]!;
    multi.del(SERVER_CHANNEL_KEY_STRING(channelId));
    if (!alsoDeletePermissions) continue;
    multi.del(SERVER_CHANNEL_PERMISSION_KEY_HASH(channelId));
  }
  await multi.exec();
};

interface FetchCanMessageOpts {
  userId: string;
  inbox: {
    recipientId: string;
    recipient: {
      account: {
        dmStatus: DmStatus;
      } | null;
    };
    createdBy: {
      account: {
        dmStatus: DmStatus;
      } | null;
    };
  };
}

const fetchCanMssage = async ({ userId, inbox }: FetchCanMessageOpts): Promise<[boolean, CanMessageError | null]> => {
  if (inbox.recipientId === userId) return [true, null] as const; // saved notes

  const requesterDmStatus = inbox.createdBy.account?.dmStatus || 0;
  const recipientDmStatus = inbox.recipient.account?.dmStatus || 0;

  const blockedRelations = await prisma.friend.findMany({
    where: {
      status: FriendStatus.BLOCKED,
      OR: [
        { recipientId: inbox.recipientId, userId },
        { recipientId: userId, userId: inbox.recipientId },
      ],
    },
  });
  if (blockedRelations.length) {
    if (blockedRelations.length === 2) {
      return [false, 'BLOCKED_BY_REQUESTER'] as const;
    }
    if (blockedRelations[0]?.userId === userId) {
      return [false, 'BLOCKED_BY_REQUESTER'] as const;
    }
    return [false, 'BLOCKED_BY_RECIPIENT'] as const;
  }
  if (!requesterDmStatus && !recipientDmStatus) return [true, null] as const;

  const areFriends = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId, recipientId: inbox.recipientId },
        { userId: inbox.recipientId, recipientId: userId },
      ],

      status: FriendStatus.FRIENDS,
    },
  });

  if (areFriends) {
    return [true, null] as const;
  }
  if (requesterDmStatus === DmStatus.FRIENDS) {
    console.log({
      what: 'NOT_FRIENDS_REQUESTER',
      recipientId: inbox.recipientId,
      requesterId: userId,
      areFriends,
    });
    return [false, 'NOT_FRIENDS_REQUESTER'] as const;
  }
  if (recipientDmStatus === DmStatus.FRIENDS) {
    console.log({
      what: 'NOT_FRIENDS_RECIPIENT',
      recipientId: inbox.recipientId,
      requesterId: userId,
      areFriends,
    });
    return [false, 'NOT_FRIENDS_RECIPIENT'] as const;
  }

  if (requesterDmStatus === DmStatus.FRIENDS_AND_SERVERS || recipientDmStatus === DmStatus.FRIENDS_AND_SERVERS) {
    const doesShareServers = await prisma.server.findFirst({
      where: {
        AND: [{ serverMembers: { some: { userId: inbox.recipientId } } }, { serverMembers: { some: { userId } } }],
      },
    });
    if (doesShareServers) {
      return [true, null] as const;
    }
  }
  if (requesterDmStatus === DmStatus.FRIENDS_AND_SERVERS) {
    return [false, 'NOT_FRIENDS_AND_SERVERS_REQUESTER'] as const;
  }
  if (recipientDmStatus === DmStatus.FRIENDS_AND_SERVERS) {
    return [false, 'NOT_FRIENDS_AND_SERVERS_RECIPIENT'] as const;
  }
  return [false, 'UNKNOWN'] as const;
};

const getInboxCache = async (channelId: string, userId: string) => {
  const cachedInboxStr = await redisClient.get(INBOX_KEY_STRING(channelId, userId));
  if (cachedInboxStr) {
    return JSON.parse(cachedInboxStr);
  }
  // get from database
  const inbox = await prisma.inbox.findFirst({
    where: {
      channelId,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: {
          account: {
            select: {
              dmStatus: true,
            },
          },
        },
      },
      recipient: {
        select: {
          bot: true,
          account: {
            select: {
              dmStatus: true,
            },
          },
        },
      },
    },
  });
  if (!inbox) return null;

  const [canMessage, canMessageError] = await fetchCanMssage({ inbox, userId });

  const stringifiedInbox = JSON.stringify({
    ...inbox,
    canMessage,
    ...(canMessageError ? { canMessageError } : {}),
    recipient: { bot: inbox.recipient.bot },
  });
  await redisClient.set(INBOX_KEY_STRING(channelId, userId), stringifiedInbox);

  return JSON.parse(stringifiedInbox);
};

export const deleteAllInboxCache = async (userId: string) => {
  const inboxList = await prisma.inbox.findMany({
    where: { createdById: userId },
    select: { recipientId: true, channelId: true },
  });
  const multi = redisClient.pipeline();
  for (let i = 0; i < inboxList.length; i++) {
    const inbox = inboxList[i];
    multi.del(INBOX_KEY_STRING(inbox.channelId, inbox.recipientId));
    multi.del(INBOX_KEY_STRING(inbox.channelId, userId));
  }
  await multi.exec();
};

// delete all inbox cache for users that are inside a server
export const deleteAllInboxCacheInServer = async (serverId: string) => {
  const inboxList = await prisma.inbox.findMany({
    where: { createdBy: { servers: { some: { id: serverId } } } },
    select: { createdById: true, recipientId: true, channelId: true },
  });
  const multi = redisClient.pipeline();
  for (let i = 0; i < inboxList.length; i++) {
    const inbox = inboxList[i];
    multi.del(INBOX_KEY_STRING(inbox.channelId, inbox.createdById));
    multi.del(INBOX_KEY_STRING(inbox.channelId, inbox.recipientId));
  }
  await multi.exec();
};
