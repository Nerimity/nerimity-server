import { prisma, publicUserExcludeFields } from '../common/database';

export const getInbox = async (userId: string) => {
  return prisma.inbox.findMany({
    where: { createdById: userId, closed: false },
    include: {
      channel: { include: { _count: { select: { attachments: true } } } },
      recipient: { select: publicUserExcludeFields },
    },
  });
};
