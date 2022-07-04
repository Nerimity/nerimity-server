import { CustomResult } from '../common/CustomResult';
import { redisClient } from '../common/redis';
import { ChannelModel } from '../models/ChannelModel';
import { InboxModel } from '../models/InboxModel';
import { DM_CHANNEL_KEY_STRING, INBOX_KEY_STRING, SERVER_CHANNEL_KEY_STRING } from './CacheKeys';
import { getServerCache, ServerCache } from './ServerCache';


export interface ChannelCache {
  _id: string,
  name?: string,
  server?: ServerCache
  inbox?: InboxCache
  createdBy: string,
}

export interface InboxCache {
  recipient: string,
  createdBy: string,
}

export const getChannelCache = async (channelId: string, userId: string): Promise<CustomResult<ChannelCache, string>> => {
  // Check server channel in cache.
  const serverChannel = await getServerChannelCache(channelId);
  if (serverChannel) {
    const server = await getServerCache(serverChannel.server);
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
  const channel = await ChannelModel.findOne({ _id: channelId }).select('-__v');

  if (!channel) return [null, 'Channel does not exist.'];

  if (channel.server) {
    const stringifiedChannel = JSON.stringify(channel);
    await redisClient.set(SERVER_CHANNEL_KEY_STRING(channelId), stringifiedChannel);

    return [{
      ...JSON.parse(stringifiedChannel), 
      server: await getServerCache(channel.server.toString()),
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

const getServerChannelCache = async (channelId: string) => {
  const channel = await redisClient.get(SERVER_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel);
};


const getInboxCache = async (channelId: string, userId: string) => {
  const inbox = await redisClient.get(INBOX_KEY_STRING(channelId, userId));
  if (inbox) {
    return JSON.parse(inbox);
  }
  // get from database
  const inboxModel = await InboxModel.findOne({ channel: channelId, createdBy: userId }).select('-_id recipient createdBy');
  if (!inboxModel) return null;
  const stringifiedInbox = JSON.stringify(inboxModel);
  await redisClient.set(INBOX_KEY_STRING(channelId, userId), stringifiedInbox);
  return JSON.parse(stringifiedInbox);
};