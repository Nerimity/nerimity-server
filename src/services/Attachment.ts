import { prisma } from '../common/database';


interface GetAttachmentOpts {
  channelId?: string;
  serverId?: string;
  limit?: number;
  afterAttachmentId?: string;
  beforeAttachmentId?: string;
}

export const getAttachments = async (opts: GetAttachmentOpts) => {
  if (!opts.limit) opts.limit = 50;
  if (opts.limit > 100) return [];
  const attachments = await prisma.attachment.findMany({
    where: {
      ...(opts.channelId ? {
        channelId: opts.channelId
      }: undefined),

      ...(opts.serverId ? {
        serverId: opts.serverId
      }: undefined),

      ...(opts.afterAttachmentId ? {
        id: {lt: opts.afterAttachmentId}
      } : undefined),

      ...(opts.beforeAttachmentId ? {
        id: {gt: opts.beforeAttachmentId}
      } : undefined),
      
    },
    take: opts.limit,
    orderBy: {createdAt: 'desc'},
    ...(opts.beforeAttachmentId ? {
      orderBy: {createdAt: 'asc'},
    } : undefined),
  });


  return attachments;
};