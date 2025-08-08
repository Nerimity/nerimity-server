import { prisma } from '../common/database';
import env from '../common/env';
import { generateError } from '../common/errorHandler';
import { generateToken } from '../common/JWT';
import { disconnectExternalServerChannelHost } from '../external-server-channel-socket/externalServerChannelSocket';

export const getExternalServerChannel = (id: string) => {
  return prisma.externalServerChannel.findUnique({ where: { id }, include: { server: { select: { name: true } }, channel: { select: { name: true } } } });
};

export const generateExternalServerChannelToken = async (channelId: string) => {
  const extChannel = await prisma.externalServerChannel.update({ where: { channelId }, data: { passwordVersion: { increment: 1 } }, select: { id: true, passwordVersion: true } });

  if (!extChannel) return [null, generateError('Channel not found')] as const;

  const token = generateToken(extChannel.id, extChannel.passwordVersion, env.JWT_EXTERNAL_SERVER_CHANNEL_SECRET);

  disconnectExternalServerChannelHost(channelId);

  return [token, null] as const;
};
