import { prisma } from '../common/database';

export const getExternalServerChannel = (id: string) => {
  return prisma.externalServerChannel.findUnique({ where: { id }, include: { server: { select: { name: true } }, channel: { select: { name: true } } } });
};
