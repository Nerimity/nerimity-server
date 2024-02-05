import { prisma } from '../common/database';
import { redisClient } from '../common/redis';
import { TicketStatus } from '../services/Ticket';
import { DmStatus } from '../services/User/User';
import { ChannelType } from '../types/Channel';
import { FriendStatus } from '../types/Friend';
import {
  DM_CHANNEL_KEY_STRING,
  INBOX_KEY_STRING,
  SERVER_CHANNEL_KEY_STRING,
  TICKET_CHANNEL_KEY_STRING,
} from './CacheKeys';
import { getServerCache, ServerCache } from './ServerCache';

export interface ServerChannelCache {
  name: string;
  serverId: string;
  permissions: number;
  type: ChannelType.SERVER_TEXT | ChannelType.CATEGORY;
  server: ServerCache;
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

export type ChannelCache = BaseChannelCache &
  (ServerChannelCache | DMChannelCache | TicketChannelCache);

export interface InboxCache {
  recipientId: string;
  createdById: string;
  canMessage: boolean;
}

export const getChannelCache = async (channelId: string, userId: string) => {
  // Check server channel in cache.
  const serverChannel = await getServerChannelCache(channelId);
  if (serverChannel) {
    const server = await getServerCache(serverChannel.serverId as string);
    return [{ ...serverChannel, server } as ChannelCache, null] as const;
  }

  // Check DM channel in cache.
  const dmChannel = await getDMChannelCache(channelId);
  if (dmChannel) {
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

const addChannelToCache = async (channelId: string, userId: string) => {
  // If not in cache, fetch from database.
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, deleting: null },
    include: {
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
    const stringifiedChannel = JSON.stringify(channel);
    await redisClient.set(
      SERVER_CHANNEL_KEY_STRING(channelId),
      stringifiedChannel
    );

    return [
      {
        ...JSON.parse(stringifiedChannel),
        server: await getServerCache(channel.serverId),
      } as ChannelCache,
      null,
    ] as const;
  }

  const stringifiedChannel = JSON.stringify(channel);

  if (channel.type === ChannelType.DM_TEXT) {
    const inbox = await getInboxCache(channelId, userId);
    return [
      { ...JSON.parse(stringifiedChannel), inbox } as ChannelCache,
      null,
    ] as const;
  }

  if (channel.type === ChannelType.TICKET) {
    await redisClient.set(
      TICKET_CHANNEL_KEY_STRING(channelId),
      stringifiedChannel
    );
    return [JSON.parse(stringifiedChannel) as ChannelCache, null] as const;
  }
  return [null, 'Unknown channel type.'] as const;
};

export const updateTicketChannelStatus = async (
  channelId: string,
  status: TicketStatus
) => {
  const channel = await getTicketChannelCache(channelId);
  if (!channel) return;

  channel.ticket.status = status;

  await redisClient.set(
    TICKET_CHANNEL_KEY_STRING(channelId),
    JSON.stringify(channel)
  );
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

export const updateServerChannelCache = async (
  channelId: string,
  update: Partial<ChannelCache>
) => {
  const cache = await getServerChannelCache(channelId);
  if (!cache) return;
  await redisClient.set(
    SERVER_CHANNEL_KEY_STRING(channelId),
    JSON.stringify({ ...cache, ...update })
  );
};

export const deleteServerChannelCaches = async (channelIds: string[]) => {
  const multi = redisClient.multi();
  for (let i = 0; i < channelIds.length; i++) {
    const channelId = channelIds[i];
    multi.del(SERVER_CHANNEL_KEY_STRING(channelId));
  }
  await multi.exec();
};

const getInboxCache = async (channelId: string, userId: string) => {
  const cachedInboxStr = await redisClient.get(
    INBOX_KEY_STRING(channelId, userId)
  );
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

  let canMessage = true;
  if (inbox.recipientId !== userId) {
    // saved notes
    const requesterDmStatus = inbox.createdBy.account?.dmStatus;
    const recipientDmStatus = inbox.recipient.account?.dmStatus;

    const blocked = await prisma.friend.findFirst({
      where: {
        status: FriendStatus.BLOCKED,
        OR: [
          { recipientId: inbox.recipientId, userId },
          { recipientId: userId, userId: inbox.recipientId },
        ],
      },
    });
    if (blocked) {
      canMessage = false;
    }

    if (!blocked && (requesterDmStatus || recipientDmStatus)) {
      canMessage = false;
      const areFriends = await prisma.friend.findFirst({
        where: {
          status: FriendStatus.FRIENDS,
          recipientId: inbox.recipientId,
          userId,
        },
      });

      canMessage = !!areFriends;

      if (
        (!areFriends &&
          requesterDmStatus === DmStatus.FRIENDS_AND_SERVERS &&
          recipientDmStatus === DmStatus.FRIENDS_AND_SERVERS) ||
        (requesterDmStatus === DmStatus.FRIENDS_AND_SERVERS &&
          recipientDmStatus === DmStatus.OPEN) ||
        (recipientDmStatus === DmStatus.FRIENDS_AND_SERVERS &&
          requesterDmStatus === DmStatus.OPEN)
      ) {
        const doesShareServers = await prisma.server.findFirst({
          where: {
            AND: [
              { serverMembers: { some: { userId: inbox.recipientId } } },
              { serverMembers: { some: { userId } } },
            ],
          },
        });
        canMessage = !!doesShareServers;
      }
    }
  }

  const stringifiedInbox = JSON.stringify({
    ...inbox,
    canMessage,
    recipient: undefined,
  });
  await redisClient.set(INBOX_KEY_STRING(channelId, userId), stringifiedInbox);

  return JSON.parse(stringifiedInbox);
};

export const deleteAllInboxCache = async (userId: string) => {
  const inboxList = await prisma.inbox.findMany({
    where: { createdById: userId },
    select: { recipientId: true, channelId: true },
  });
  const multi = redisClient.multi();
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
  const multi = redisClient.multi();
  for (let i = 0; i < inboxList.length; i++) {
    const inbox = inboxList[i];
    multi.del(INBOX_KEY_STRING(inbox.channelId, inbox.createdById));
    multi.del(INBOX_KEY_STRING(inbox.channelId, inbox.recipientId));
  }
  await multi.exec();
};
