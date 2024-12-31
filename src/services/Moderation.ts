import { removeUserCacheByUserIds } from '../cache/UserCache';
import { dateToDateTime, prisma } from '../common/database';
import { generateId } from '../common/flakeId';
import { ModAuditLogType } from '../common/ModAuditLog';
import { removeDuplicates } from '../common/utils';
import { emitErrorTo } from '../emits/Connection';
import { emitUserNoticeCreates } from '../emits/User';
import { NoticeType } from '../routes/moderation/userBatchWarn';

interface DisconnectUsersOptions {
  userIds: string[];
  message?: string;
  type?: string;
  reason?: string;
  expire?: string | null;
  by?: { username: string };
  clearCache: boolean;
}

export async function disconnectUsers(opts: DisconnectUsersOptions) {
  if (!opts.userIds.length) {
    return;
  }

  if (opts.clearCache) {
    await removeUserCacheByUserIds(opts.userIds);
  }

  emitErrorTo({
    to: opts.userIds,
    disconnect: true,
    message: opts.message || 'You are suspended.',
    data: {
      type: opts.type || 'suspend',
      reason: opts.reason,
      expire: opts.expire,
      ...(opts.by ? { by: opts.by } : {}),
    },
  });
}

interface WarnUsersOpts {
  userIds: string[];
  reason: string;
  modUserId: string;
  skipAuditLog?: boolean;
}
export async function warnUsersBatch(opts: WarnUsersOpts) {
  if (opts.userIds.length >= 5000) return [null, 'user ids must contain less than 5000 ids.'] as const;

  const sanitizedUserIds = removeDuplicates(opts.userIds) as string[];

  const sixMonthsMS = new Date().setMonth(new Date().getMonth() + 6);

  await prisma.account.updateMany({
    where: {
      warnExpiresAt: {
        lt: dateToDateTime(),
      },
    },
    data: {
      warnCount: 0,
      warnExpiresAt: null,
    },
  });

  await prisma.account.updateMany({
    where: {
      userId: { in: sanitizedUserIds },
    },
    data: {
      warnCount: { increment: 1 },
      warnExpiresAt: dateToDateTime(sixMonthsMS),
    },
  });

  const noticeIds: string[] = [];

  await prisma.userNotice.createMany({
    data: sanitizedUserIds.map((userId) => {
      const id = generateId();
      noticeIds.push(id);

      return {
        id,
        userId,
        content: opts.reason,
        type: NoticeType.Warning,
        createdById: opts.modUserId,
      };
    }),
  });

  const createdNotices = await prisma.userNotice.findMany({
    where: { id: { in: noticeIds } },
    select: { userId: true, id: true, type: true, title: true, content: true, createdAt: true, createdBy: { select: { username: true } } },
  });

  emitUserNoticeCreates(createdNotices);

  if (!opts.skipAuditLog) {
    const warnedUsers = await prisma.user.findMany({
      where: { id: { in: sanitizedUserIds } },
      select: { id: true, username: true },
    });
    await prisma.modAuditLog.createMany({
      data: warnedUsers.map((user) => ({
        id: generateId(),
        actionType: ModAuditLogType.userWarned,
        actionById: opts.modUserId,
        username: user.username,
        userId: user.id,
        reason: opts.reason,
      })),
    });
  }

  return [true, null] as const;
}
