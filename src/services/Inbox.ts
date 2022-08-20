import { prisma } from '../common/database';

export const getInbox = async (userId: string) => {
  return prisma.inbox.findMany({where: {createdById: userId, closed: false}, include: {channel: true, recipient: true}});
};