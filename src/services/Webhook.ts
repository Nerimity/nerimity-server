import { removeWebhookCache } from '../cache/WebhookCache';
import { prisma } from '../common/database';
import env from '../common/env';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { generateToken } from '../common/JWT';
import { generateHexColor } from '../common/random';
import { ChannelType } from '../types/Channel';

interface CreateWebhookOpts {
  serverId: string;
  channelId: string;
  createdById: string;
}

export const getWebhookToken = async (serverId: string, webhookId: string) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId, serverId } });

  if (!webhook) return [null, generateError('Webhook not found.')] as const;

  const token = generateToken(webhook.id, 1, env.JWT_WEBHOOK_SECRET);

  return [token, null] as const;
};

export const createWebhook = async (opts: CreateWebhookOpts) => {
  const existingCount = await prisma.webhook.count({ where: { serverId: opts.serverId, channelId: opts.channelId } });
  if (existingCount >= 4) return [null, generateError('You have already created the maximum amount of webhooks for this channel.')] as const;

  const channel = await prisma.channel.findUnique({ where: { id: opts.channelId, serverId: opts.serverId, type: ChannelType.SERVER_TEXT } });

  if (!channel) return [null, generateError('Channel not found.')] as const;

  const webhook = await prisma.webhook.create({ data: { hexColor: generateHexColor(), id: generateId(), serverId: opts.serverId, channelId: opts.channelId, name: 'Webhook ' + existingCount, createdById: opts.createdById } });

  return [webhook, null] as const;
};

export const getWebhooks = async (serverId: string, channelId: string) => prisma.webhook.findMany({ where: { serverId, channelId }, orderBy: { createdAt: 'desc' } });
export const getWebhook = async (id: string) => prisma.webhook.findUnique({ where: { id } });

export const getWebhookForCache = async (id: string) => prisma.webhook.findUnique({ where: { id }, include: { channel: { select: { type: true } } } });

export const deleteWebhook = async (serverId: string, channelId: string, webhookId: string) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId, serverId, channelId } });

  if (!webhook) return [null, generateError('Webhook not found.')] as const;

  await prisma.webhook.delete({ where: { id: webhookId } });

  await removeWebhookCache(webhookId);

  return [true, null] as const;
};
