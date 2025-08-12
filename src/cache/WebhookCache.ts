import { redisClient } from '../common/redis';
import { getWebhookForCache } from '../services/Webhook';
import { ChannelType } from '../types/Channel';
import { WEBHOOK_CACHE_KEY_STRING } from './CacheKeys';

interface WebhookCache {
  id: string;
  channelId: string;
  serverId: string;
  channel: {
    type: ChannelType;
  };
}

export const fetchWebhookCache = async (opts: { id: string }) => {
  const key = WEBHOOK_CACHE_KEY_STRING(opts.id);
  const rawValue = await redisClient.get(key);

  if (rawValue) {
    const value = JSON.parse(rawValue) as WebhookCache;
    return value;
  }

  // fetch from database
  const webhook = await getWebhookForCache(opts.id);

  if (!webhook) return null;

  const data = {
    id: webhook.id,
    channelId: webhook.channelId,
    serverId: webhook.serverId,
    channel: webhook.channel,
  } as WebhookCache;

  await redisClient.set(key, JSON.stringify(data), { EX: 1800 }); // 30 minutes

  return data;
};

export const removeWebhookCache = async (id: string) => {
  const key = WEBHOOK_CACHE_KEY_STRING(id);
  await redisClient.del(key);
};
