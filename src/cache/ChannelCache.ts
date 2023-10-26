import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { redisClient } from '../common/redis';
import { DmStatus } from '../services/User/User';
import { ChannelType } from '../types/Channel';
import { FriendStatus } from '../types/Friend';
import {
  DM_CHANNEL_KEY_STRING,
  INBOX_KEY_STRING,
  SERVER_CHANNEL_KEY_STRING,
} from './CacheKeys';
import { getServerCache, ServerCache } from './ServerCache';

export interface ChannelCache {
  id: string;
  name?: string;
  serverId?: string;
  server?: ServerCache;
  inbox?: InboxCache;
  permissions: number;
  createdById: string;
  type: ChannelType;
}

export interface InboxCache {
  recipientId: string;
  createdById: string;
  canMessage: boolean;
}

export const getChannelCache = async (
  channelId: string,
  userId: string
): Promise<CustomResult<ChannelCache, string>> => {
  // Check server channel in cache.
  const serverChannel = await getServerChannelCache(channelId);
  if (serverChannel) {
    const server = await getServerCache(serverChannel.serverId as string);
    return [{ ...serverChannel, server }, null];
  }

  // Check DM channel in cache.
  const dmChannel = await getDMChannelCache(channelId);
  if (dmChannel) {
    const inbox = await getInboxCache(channelId, userId);
    if (!inbox) return [null, 'Inbox not found.'];
    return [{ ...dmChannel, inbox }, null];
  }

  // If not in cache, fetch from database.
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, deleting: null },
  });

  if (!channel) return [null, 'Channel does not exist.'];

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
      },
      null,
    ];
  }

  // get inbox
  const inbox = await getInboxCache(channelId, userId);

  const stringifiedChannel = JSON.stringify(channel);
  await redisClient.set(DM_CHANNEL_KEY_STRING(channelId), stringifiedChannel);

  return [{ ...JSON.parse(stringifiedChannel), inbox }, null];
};

const getDMChannelCache = async (channelId: string) => {
  const channel = await redisClient.get(DM_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel);
};

const getServerChannelCache = async (
  channelId: string
): Promise<ChannelCache | null> => {
  const channel = await redisClient.get(SERVER_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel);
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
