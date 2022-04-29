import { CustomResult } from '../common/CustomResult';
import { redisClient } from '../common/redis';
import { ChannelModel } from '../models/ChannelModel';
import { SERVER_CHANNEL_KEY_STRING } from './CacheKeys';
import { getServerCache, ServerCache } from './ServerCache';


export interface ChannelCache {
  _id: string,
  name?: string,
  server?: ServerCache
}

export const getChannelCache = async (channelId: string): Promise<CustomResult<ChannelCache, string>> => {
  // Check server channel in cache.
  const serverChannel = await getServerChannelCache(channelId);
  if (serverChannel) {
    const server = await getServerCache(serverChannel.server);
    return [{...serverChannel, server}, null];
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
  return [null, 'DM channel not implemented.'];
};

const getServerChannelCache = async (channelId: string) => {
  const channel = await redisClient.get(SERVER_CHANNEL_KEY_STRING(channelId));
  if (!channel) return null;
  return JSON.parse(channel);
};