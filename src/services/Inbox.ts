import { prisma, publicUserExcludeFields } from '../common/database';

export const getInbox = async (userId: string) => {
  return prisma.inbox.findMany({
    where: { createdById: userId, closed: false },
    include: {
      channel: true,
      recipient: { select: { ...publicUserExcludeFields, profile: { select: { font: true, clan: { select: { tag: true, icon: true, serverId: true } } } } } },
    },
  });
};
