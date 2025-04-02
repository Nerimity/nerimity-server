import { removeAllowedIPsCache, removeUserCacheByUserIds } from '../cache/UserCache';
import { hasBit, USER_BADGES } from '../common/Bitwise';
import { dateToDateTime, prisma } from '../common/database';
import { generateError } from '../common/errorHandler';
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
  modUsername: string;
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

  // if a user gets 3 warnings within 6 months, they get 7 day week ban and IP ban
  // If they get 6 warnings, we make it a month

  const usersToSuspend = await prisma.account.findMany({
    where: {
      userId: { in: sanitizedUserIds },
    },
    select: {
      userId: true,
      warnCount: true,
    },
  });

  const twoWarnings = usersToSuspend.filter((user) => user.warnCount >= 2 && user.warnCount < 5);
  const fiveWarnings = usersToSuspend.filter((user) => user.warnCount >= 5);

  if (twoWarnings.length) {
    await suspendUsersBatch({ userIds: twoWarnings.map((u) => u.userId), days: 7, suspendByUserId: opts.modUserId, suspendByUsername: opts.modUsername, ipBan: true, reason: 'Warned 3 times in 6 months.' });
  }

  if (fiveWarnings.length) {
    await suspendUsersBatch({ userIds: fiveWarnings.map((u) => u.userId), days: 30, suspendByUserId: opts.modUserId, suspendByUsername: opts.modUsername, ipBan: true, reason: 'Warned 6 times in 6 months.' });
  }

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

interface SuspendUsersOpts {
  userIds: string[];
  days: number;
  reason?: string;
  ipBan?: boolean;
  deleteRecentMessages?: boolean;
  suspendByUserId: string;
  suspendByUsername: string;
}

const SUSPEND_DAY_IN_MS = 86400000;
const expireAfter = (days: number) => {
  const now = Date.now();
  const expireDate = new Date(now + SUSPEND_DAY_IN_MS * days);
  return expireDate;
};

export async function suspendUsersBatch(opts: SuspendUsersOpts) {
  if (opts.userIds.length >= 5000) return [null, generateError('user ids must contain less than 5000 ids.')] as const;

  const sanitizedUserIds = removeDuplicates(opts.userIds) as string[];

  const users = await prisma.user.findMany({
    where: { id: { in: sanitizedUserIds } },
    select: { badges: true },
  });

  const hasFounderBadge = users.find((u) => hasBit(u.badges, USER_BADGES.FOUNDER.bit));

  if (hasFounderBadge) {
    return [null, generateError('You are not allowed to suspend the founder.')] as const;
  }

  const expireDateTime = dateToDateTime(expireAfter(opts.days));

  const suspendedUsers = await prisma.suspension.findMany({
    where: { userId: { in: sanitizedUserIds } },
    select: { userId: true },
  });

  const suspendedUserIds = suspendedUsers.map((suspend) => suspend.userId);

  // Only increment if not suspended
  const incrementUserIds = sanitizedUserIds.filter((id) => !suspendedUserIds.includes(id));

  await prisma.account.updateMany({
    where: {
      userId: { in: incrementUserIds },
    },
    data: {
      suspendCount: { increment: 1 },
    },
  });

  await prisma.$transaction(
    sanitizedUserIds.map((userId) =>
      prisma.suspension.upsert({
        where: { userId },
        create: {
          id: generateId(),
          userId,
          suspendedById: opts.suspendByUserId,
          reason: opts.reason,
          expireAt: opts.days ? expireDateTime : null,
        },
        update: {
          suspendedById: opts.suspendByUserId,
          reason: opts.reason || null,
          expireAt: opts.days ? expireDateTime : null,
        },
      })
    )
  );

  await prisma.firebaseMessagingToken.deleteMany({
    where: { account: { userId: { in: sanitizedUserIds } } },
  });

  await disconnectUsers({
    userIds: sanitizedUserIds,
    clearCache: true,
    reason: opts.reason,
    expire: opts.days ? expireDateTime : null,
    by: {
      username: opts.suspendByUsername,
    },
  });

  if (opts.ipBan) {
    const ipExpireDateTime = dateToDateTime(expireAfter(7));

    const suspendedUserDevices = await prisma.userDevice.findMany({
      where: { userId: { in: sanitizedUserIds } },
    });
    const suspendedUserIps = suspendedUserDevices.map((device) => device.ipAddress);

    const userDevicesWithSameIPs = await prisma.userDevice.findMany({
      where: { ipAddress: { in: suspendedUserIps } },
    });
    const ips = userDevicesWithSameIPs.map((device) => device.ipAddress);
    const userIds = userDevicesWithSameIPs.map((device) => device.userId);
    await removeAllowedIPsCache(ips);

    await prisma.$transaction(
      ips.map((ip) =>
        prisma.bannedIp.upsert({
          where: { ipAddress: ip },
          create: {
            id: generateId(),
            ipAddress: ip,
            expireAt: ipExpireDateTime,
          },
          update: {},
        })
      )
    );

    await disconnectUsers({
      userIds: userIds,
      clearCache: true,
      type: 'ip-ban',
      message: 'You have been IP Banned',
      expire: ipExpireDateTime,
    });

    if (ips.length) {
      await prisma.modAuditLog
        .create({
          data: {
            id: generateId(),
            actionType: ModAuditLogType.ipBan,
            actionById: opts.suspendByUserId,
            count: removeDuplicates(ips).length,
            expireAt: dateToDateTime(expireAfter(7)),
          },
        })
        .catch(() => {});
    }
  }

  const newSuspendedUsers = await prisma.user.findMany({
    where: { id: { in: sanitizedUserIds } },
    select: { id: true, username: true },
  });

  await prisma.modAuditLog.createMany({
    data: newSuspendedUsers.map((user) => ({
      id: generateId(),
      actionType: ModAuditLogType.userSuspend,
      actionById: opts.suspendByUserId,
      username: user.username,
      userId: user.id,
      reason: opts.reason,
      expireAt: opts.days ? expireDateTime : null,
    })),
  });

  if (opts.deleteRecentMessages) {
    const lastSevenHours = new Date();
    lastSevenHours.setHours(lastSevenHours.getHours() - 7);

    await prisma.message.deleteMany({
      where: {
        createdById: { in: sanitizedUserIds },
        createdAt: {
          gt: dateToDateTime(lastSevenHours),
        },
      },
    });
  }

  return [true, null] as const;
}

interface ShadowBanUsersOpts {
  userIds: string[];
  reason: string;
  modUserId: string;
  modUsername: string;
}
export async function shadowBanUsersBatch(opts: ShadowBanUsersOpts) {
  if (opts.userIds.length >= 5000) return [null, 'user ids must contain less than 5000 ids.'] as const;

  let sanitizedUserIds = removeDuplicates(opts.userIds) as string[];

  const alreadyShadowBanned = await prisma.shadowBan.findMany({
    where: { userId: { in: sanitizedUserIds } },
  });

  if (alreadyShadowBanned.length) {
    sanitizedUserIds = sanitizedUserIds.filter((id) => !alreadyShadowBanned.find((shadowBan) => shadowBan.userId === id));
  }
  if (!sanitizedUserIds.length) return [true, null] as const;

  const shadowBans = await prisma.shadowBan.createManyAndReturn({
    data: sanitizedUserIds.map((userId) => ({
      id: generateId(),
      userId,
      reason: opts.reason,
      bannedById: opts.modUserId,
    })),
    select: {
      user: {
        select: {
          username: true,
          id: true,
        },
      },
    },
  });
  await removeUserCacheByUserIds(sanitizedUserIds);

  const lastSevenHours = new Date();
  lastSevenHours.setHours(lastSevenHours.getHours() - 7);

  await prisma.message.deleteMany({
    where: {
      createdById: { in: sanitizedUserIds },
      createdAt: {
        gt: dateToDateTime(lastSevenHours),
      },
    },
  });

  await prisma.modAuditLog.createMany({
    data: shadowBans.map((shadowBan) => ({
      id: generateId(),
      actionType: ModAuditLogType.userShadowBanned,
      actionById: opts.modUserId,
      username: shadowBan.user.username,
      userId: shadowBan.user.id,
      reason: opts.reason,
    })),
  });

  return [true, null] as const;
}

interface UndoShadowBanUsersOpts {
  userIds: string[];
  modUserId: string;
  modUsername: string;
}
export async function undoShadowBanUsersBatch(opts: UndoShadowBanUsersOpts) {
  if (opts.userIds.length >= 5000) return [null, 'user ids must contain less than 5000 ids.'] as const;

  const sanitizedUserIds = removeDuplicates(opts.userIds) as string[];

  if (!sanitizedUserIds.length) return [true, null] as const;

  await prisma.shadowBan.deleteMany({
    where: {
      userId: { in: sanitizedUserIds },
    },
  });

  await removeUserCacheByUserIds(sanitizedUserIds);

  const users = await prisma.user.findMany({
    where: { id: { in: sanitizedUserIds } },
    select: { username: true, id: true },
  });

  await prisma.modAuditLog.createMany({
    data: users.map((user) => ({
      id: generateId(),
      actionType: ModAuditLogType.undoUserShadowBanned,
      actionById: opts.modUserId,
      username: user.username,
      userId: user.id,
    })),
  });

  return [true, null] as const;
}
