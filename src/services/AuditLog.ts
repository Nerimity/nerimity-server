import { AuditLog } from '@src/generated/prisma/client';
import { prisma } from '../common/database';
import { generateId } from '../common/flakeId';

export enum AuditLogType {
  SERVER_OWNERSHIP_UPDATE = 'SERVER_OWNERSHIP_UPDATE',
  SERVER_DELETE = 'SERVER_DELETE',
  SERVER_UPDATE = 'SERVER_UPDATE',

  SERVER_USER_BAN = 'SERVER_USER_BAN',
  SERVER_USER_UNBAN = 'SERVER_USER_UNBAN',
  SERVER_USER_KICK = 'SERVER_USER_KICK',
  SERVER_USER_UPDATE = 'SERVER_USER_UPDATE',

  SERVER_CHANNEL_CREATE = 'SERVER_CHANNEL_CREATE',
  SERVER_CHANNEL_UPDATE = 'SERVER_CHANNEL_UPDATE',
  SERVER_CHANNEL_DELETE = 'SERVER_CHANNEL_DELETE',

  SERVER_ROLE_CREATE = 'SERVER_ROLE_CREATE',
  SERVER_ROLE_UPDATE = 'SERVER_ROLE_UPDATE',
  SERVER_ROLE_DELETE = 'SERVER_ROLE_DELETE',
}

interface ServerOwnershipUpdateAuditLog {
  actionType: AuditLogType.SERVER_OWNERSHIP_UPDATE;
  serverId: string;
  data: {
    oldOwnerUserId: string;
    newOwnerUserId: string;
  };
}
interface ServerDeleteAuditLog {
  actionType: AuditLogType.SERVER_DELETE;
  serverId: string;
  data: {
    serverName: string;
  };
}

interface ServerUserBanAuditLog {
  actionType: AuditLogType.SERVER_USER_BAN;
  serverId: string;
  data: {
    bannedUserId: string;
  };
}

interface ServerUserUnbanAuditLog {
  actionType: AuditLogType.SERVER_USER_UNBAN;
  serverId: string;
  data: {
    unbannedUserId: string;
  };
}

interface ServerUserKickAuditLog {
  actionType: AuditLogType.SERVER_USER_KICK;
  serverId: string;
  data: {
    kickedUserId: string;
  };
}
type TypedAuditLog = Omit<AuditLog, 'data'> & (ServerOwnershipUpdateAuditLog | ServerDeleteAuditLog | ServerUserBanAuditLog | ServerUserUnbanAuditLog | ServerUserKickAuditLog);

interface ServerOwnershipUpdateOpts {
  serverId: string;
  oldOwnerUserId: string;
  newOwnerUserId: string;
}

export const logServerOwnershipUpdate = async (opts: ServerOwnershipUpdateOpts) => {
  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: AuditLogType.SERVER_OWNERSHIP_UPDATE,
      serverId: opts.serverId,
      actionById: opts.oldOwnerUserId,
      data: {
        oldOwnerUserId: opts.oldOwnerUserId,
        newOwnerUserId: opts.newOwnerUserId,
      },
    },
  });
};

interface AddServerAuditLogOpts {
  actionType: AuditLogType;
  actionById: string;
  serverId: string;
  data?: Record<string, any>;
}

export const addServerAuditLog = async (opts: AddServerAuditLogOpts) => {
  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: opts.actionType,
      actionById: opts.actionById,
      serverId: opts.serverId,
      data: opts.data,
    },
  });
};

interface ServerDeleteOpts {
  serverId: string;
  userId: string;
  serverName: string;
}

export const logServerDelete = async (opts: ServerDeleteOpts) => {
  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: AuditLogType.SERVER_DELETE,
      actionById: opts.userId,
      serverId: opts.serverId,
      data: {
        serverName: opts.serverName,
      },
    },
  });
};

interface ServerBannedUserOpts {
  serverId: string;
  userId?: string;
  bannedUserId: string;
  reason?: string;
}
export const logServerUserBanned = async (opts: ServerBannedUserOpts) => {
  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: AuditLogType.SERVER_USER_BAN,
      actionById: opts.userId || 'System',
      serverId: opts.serverId,
      reason: opts.reason,
      data: {
        bannedUserId: opts.bannedUserId,
      },
    },
  });
};

interface ServerUnbannedUserOpts {
  serverId: string;
  userId: string;
  unbannedUserId: string;
}

export const logServerUserUnbanned = async (opts: ServerUnbannedUserOpts) => {
  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: AuditLogType.SERVER_USER_UNBAN,
      actionById: opts.userId,
      serverId: opts.serverId,
      data: {
        unbannedUserId: opts.unbannedUserId,
      },
    },
  });
};

interface ServerKickedUserOpts {
  serverId: string;
  userId: string;
  kickedUserId: string;
}

export const logServerUserKicked = async (opts: ServerKickedUserOpts) => {
  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: AuditLogType.SERVER_USER_KICK,
      actionById: opts.userId,
      serverId: opts.serverId,
      data: {
        kickedUserId: opts.kickedUserId,
      },
    },
  });
};

export const getAuditLogs = async (serverId?: string, limit?: number, afterId?: string, search?: string) => {
  const auditLogs = (await prisma.auditLog.findMany({
    where: {
      serverId,
      ...(search ? { OR: [{ serverId: search }, { actionById: search }] } : undefined),
    },
    ...(afterId ? { skip: 1 } : undefined),
    ...(afterId ? { cursor: { id: afterId } } : undefined),
    orderBy: { createdAt: 'desc' },
    take: limit || 50,
  })) as TypedAuditLog[];

  const userIdSet = new Set<string>();
  const serverIdSet = new Set<string>();

  auditLogs.forEach((auditLog) => {
    userIdSet.add(auditLog.actionById);
    serverIdSet.add(auditLog.serverId);
    switch (auditLog.actionType) {
      case AuditLogType.SERVER_OWNERSHIP_UPDATE:
        userIdSet.add(auditLog.data.newOwnerUserId);
        userIdSet.add(auditLog.data.oldOwnerUserId);
        break;
      case AuditLogType.SERVER_USER_BAN:
        userIdSet.add(auditLog.data.bannedUserId);
        break;
      case AuditLogType.SERVER_USER_UNBAN:
        userIdSet.add(auditLog.data.unbannedUserId);
        break;
      case AuditLogType.SERVER_USER_KICK:
        userIdSet.add(auditLog.data.kickedUserId);
        break;
    }
  });

  const userIds = Array.from(userIdSet).filter((id) => id && id !== 'System');
  const serverIds = Array.from(serverIdSet).filter((id) => id);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });
  const servers = await prisma.server.findMany({
    where: { id: { in: serverIds } },
    select: { name: true, id: true },
  });

  return { auditLogs, users, servers };
};
