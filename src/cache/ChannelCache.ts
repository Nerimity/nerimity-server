import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { redisClient } from '../common/redis';
import { DmStatus } from '../services/User';
import { ChannelType } from '../types/Channel';
import { FriendStatus } from '../types/Friend';
import { DM_CHANNEL_KEY_STRING, INBOX_KEY_STRING, SERVER_CHANNEL_KEY_STRING } from './CacheKeys';
import { getServerCache, ServerCache } from './ServerCache';


export interface ChannelCache {
  id: string,
  name?: string,
  serverId?: string,
  server?: ServerCache
  inbox?: InboxCache
  permissions: number,
  createdById: string,
  type: ChannelType
}

export interface InboxCache {
  recipientId: string,
  createdById: string,
  canMessage: boolean;
}

export const getChannelCache = async (channelId: string, userId: string): Promise<CustomResult<ChannelCache, string>> => {
  // Check server channel in cache.
  const serverChannel = await getServerChannelCache(channelId);
  if (serverChannel) {
    const server = await getServerCache(serverChannel.serverId as string);
    return [{...serverChannel, server}, null];
  }

  // Check DM channel in cache.
  const dmChannel = await getDMChannelCache(channelId);
  if (dmChannel) {
    const inbox = await getInboxCache(channelId, userId);
    if (!inbox) return [null, 'Inbox not found.'];
    return [{...dmChannel, inbox}, null];
  }

  // If not in cache, fetch from database.
  const channel = await prisma.channel.findFirst({where: {id: channelId}});

  if (!channel) return [null, 'Channel does not exist.'];

  if (channel.serverId) {
    const stringifiedChannel = JSON.stringify(channel);
    await redisClient.set(SERVER_CHANNEL_KEY_STRING(channelId), stringifiedChannel);

    return [{
      ...JSON.parse(stringifiedChannel), 
      server: await getServerCache(channel.serverId),
    }, null];
  }
  
  // get inbox
  const inbox = await getInboxCache(channelId, userId);


  const stringifiedChannel = JSON.stringify(channel);
  await redisClient.set(DM_CHANNEL_KEY_STRING(channelId), stringifiedChannel);


  return [{...JSON.parse(stringifiedChannel), inbox}, null];
};

const getDMChannelCache = async (channelId: string) => {
  const channel = await redisClient.get(DM_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel);
};

const getServerChannelCache = async (channelId: string): Promise<ChannelCache | null> => {
  const channel = await redisClient.get(SERVER_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel);
};

export const updateServerChannelCache = async (channelId: string, update: Partial<ChannelCache>) => {
  const cache = await getServerChannelCache(channelId);
  if (!cache) return;
  await redisClient.set(SERVER_CHANNEL_KEY_STRING(channelId), JSON.stringify({...cache, ...update}));
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
  const cachedInboxStr = await redisClient.get(INBOX_KEY_STRING(channelId, userId));
  if (cachedInboxStr) {
    return JSON.parse(cachedInboxStr);
  }
  // get from database
  const inbox = await prisma.inbox.findFirst({
    where: {
      channelId,
      createdById: userId
    },
    include: {
      recipient: {
        select: {
          account: {
            select: {
              dmStatus: true
            }
          }
        }
      }
    }
  });
  if (!inbox) return null;

  let canMessage = false;
  const dmStatus = inbox.recipient.account?.dmStatus

  if (dmStatus) {
    const areFriends = await prisma.friend.findFirst({where: {status: FriendStatus.FRIENDS, recipientId: inbox.recipientId, userId}});

    canMessage = !!areFriends;

    if (!areFriends && dmStatus === DmStatus.FRIENDS_AND_SERVERS) {
      const doesShareServers = await prisma.server.findFirst({
        where: {serverMembers: {
          some: {userId: {in: [inbox.recipientId, userId]}}
        }}
      })
      canMessage = !!doesShareServers;
    }
  }



  const stringifiedInbox = JSON.stringify({...inbox, canMessage, recipient: undefined });
  await redisClient.set(INBOX_KEY_STRING(channelId, userId), stringifiedInbox);
  return JSON.parse(stringifiedInbox);
};
