import { deleteAllServerMemberCache } from '../cache/ServerMemberCache';
import { CustomResult } from '../common/CustomResult';
import { prisma, removeRoleIdFromServerMembers } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, hasBit } from '../common/Bitwise';
import { emitServerRoleCreated, emitServerRoleDeleted, emitServerRoleOrderUpdated, emitServerRoleUpdated } from '../emits/Server';
import { updatePrivateChannelSocketRooms } from './Channel';
import { convertLinearGradientStringToFormat, isValidHex } from '../common/utils';
import { removeServerMemberPermissionsCache } from '../cache/ChannelCache';
import { addServerAuditLog, AuditLogType } from './AuditLog';
import { permission } from 'process';
import { addToObjectIfExists } from '@src/common/addToObjectIfExists';

export const createServerRole = async (name: string, creatorId: string, serverId: string, opts?: { permissions?: number; bot?: boolean }) => {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { defaultRoleId: true, verified: true },
  });

  if (!server) {
    return [null, generateError('Server not found.')] as const;
  }

  if (!opts?.bot) {
    const roleCount = await prisma.serverRole.count({
      where: {
        serverId,
        OR: [{ botRole: false }, { botRole: null }],
      },
    });

    if (server.verified && roleCount - 1 >= 200) {
      return [null, generateError('You already created the maximum amount of roles for this server.')] as const;
    }

    if (!server.verified && roleCount - 1 >= env.MAX_ROLES_PER_SERVER) {
      return [null, generateError('You already created the maximum amount of roles for this server.')] as const;
    }
  }

  const roles = await prisma.serverRole.findMany({
    where: { serverId, id: { not: server?.defaultRoleId } },
    orderBy: { order: 'asc' },
  });

  const transactions = [
    prisma.serverRole.create({
      data: {
        id: generateId(),
        name,
        serverId,
        permissions: opts?.permissions || ROLE_PERMISSIONS.SEND_MESSAGE.bit,
        order: 2,
        hexColor: env.DEFAULT_SERVER_ROLE_COLOR,
        ...(opts?.bot ? { botRole: true, hideRole: true } : {}),

        createdById: creatorId,
      },
    }),
  ];
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    transactions.push(
      prisma.serverRole.update({
        where: { id: role!.id },
        data: { order: i + 3 },
      })
    );
  }

  const [createdRole] = await prisma.$transaction(transactions);

  await deleteAllServerMemberCache(serverId);
  emitServerRoleCreated(serverId, createdRole);

  if (!opts?.bot) {
    addServerAuditLog({
      actionType: AuditLogType.SERVER_ROLE_CREATE,
      actionById: creatorId,
      serverId: serverId,
      data: {
        name,
        permissions: createdRole?.permissions || 0,
      },
    });
  }

  return [createdRole, null] as const;
};

export interface UpdateServerRoleOptions {
  name?: string;
  permissions?: number;
  hexColor?: string;
  hideRole?: boolean;
  icon?: string | null;
  applyOnJoin?: boolean;
}

export const updateServerRole = async (serverId: string, roleId: string, update: UpdateServerRoleOptions, actionById?: string): Promise<CustomResult<UpdateServerRoleOptions, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const role = await prisma.serverRole.findFirst({
    where: { id: roleId, serverId },
  });
  if (!role) {
    return [null, generateError('Role does not exist.')];
  }

  if (role.id === server.defaultRoleId) {
    if (update.hideRole !== undefined) {
      return [null, generateError('Cannot hide default role.')];
    }
    if (update.applyOnJoin) {
      return [null, generateError('Default role is already applied on join.')];
    }
  }

  if (update.hexColor) {
    if (update.hexColor.startsWith('linear-gradient')) {
      const [gradient, gradientError] = convertLinearGradientStringToFormat(update.hexColor);
      if (gradientError) return [null, generateError('hexColor: ' + gradientError)];
      if (gradient) {
        update.hexColor = gradient;
      }
    }

    const validHex = isValidHex(update.hexColor);
    if (!validHex) {
      return [null, generateError('Invalid hex color.')];
    }
  }

  if (role.botRole) {
    if (update.applyOnJoin) {
      return [null, generateError('Cannot apply on join to a bot role.')];
    }
  }

  await prisma.serverRole.update({ where: { id: role.id }, data: update });

  await deleteAllServerMemberCache(serverId);

  emitServerRoleUpdated(serverId, roleId, update);

  const serverChannels = await prisma.channel.findMany({
    where: { serverId },
    select: { id: true, permissions: true },
  });
  await updatePrivateChannelSocketRooms({
    serverId,
    channels: serverChannels,
  });

  if (actionById) {
    addServerAuditLog({
      actionType: AuditLogType.SERVER_ROLE_UPDATE,
      actionById: actionById,
      serverId: serverId,
      data: {
        ...addToObjectIfExists('name', update.name),
        ...addToObjectIfExists('permissions', update.permissions),
        ...addToObjectIfExists('hideRole', update.hideRole),
        ...addToObjectIfExists('applyOnJoin', update.applyOnJoin),
        ...addToObjectIfExists('hexColor', update.hexColor, !!update.hexColor),
        ...addToObjectIfExists('icon', update.icon, !!update.icon),
      },
    });
  }

  return [update, null];
};

export const deleteServerRole = async (serverId: string, roleId: string, opts?: { forceDeleteBotRole: boolean }, actionById?: string) => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  const role = await prisma.serverRole.findFirst({
    where: { id: roleId, serverId },
  });
  if (!role) {
    return [null, generateError('Role does not exist.')];
  }

  if (!opts?.forceDeleteBotRole && role.botRole) {
    return [null, generateError('Cannot delete bot role.')];
  }

  if (server.defaultRoleId === role.id) {
    return [null, generateError('Cannot delete default role.')];
  }

  const roleChannelPermissions = await prisma.serverChannelPermissions.findMany({ where: { roleId }, select: { channelId: true } });

  let serverRoles = await prisma.serverRole.findMany({
    where: { serverId },
    orderBy: { order: 'asc' },
  });
  serverRoles = serverRoles.filter((role) => role.id !== roleId);

  const transactions = [removeRoleIdFromServerMembers(roleId), prisma.serverRole.delete({ where: { id: roleId } })];

  for (let i = 0; i < serverRoles.length; i++) {
    const role = serverRoles[i]!;
    transactions.push(
      prisma.serverRole.update({
        where: { id: role.id },
        data: { order: i + 1 },
      })
    );
  }

  await prisma.$transaction(transactions);

  const serverChannels = await prisma.channel.findMany({
    where: { serverId },
    select: { id: true, permissions: true },
  });

  await updatePrivateChannelSocketRooms({
    serverId,
    channels: serverChannels,
  });

  deleteAllServerMemberCache(serverId);
  await removeServerMemberPermissionsCache(roleChannelPermissions.map((c) => c.channelId));
  emitServerRoleDeleted(serverId, roleId);

  if (!role.botRole) {
    if (actionById) {
      addServerAuditLog({
        actionType: AuditLogType.SERVER_ROLE_DELETE,
        actionById: actionById,
        serverId: serverId,
        data: {
          name: role.name,
        },
      });
    }
  }

  return [role, null];
};

export const updateServerRoleOrder = async (requesterTopRole: number, serverId: string, roleIds: string[]) => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: {
      roles: { orderBy: { order: 'asc' }, select: { order: true, id: true } },
    },
  });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const changingHigherPriorityRole = roleIds.find((roleId, index) => {
    const role = server.roles.find((r) => r.id === roleId)!;
    if (!role) return false;
    const shouldMove = role.order < requesterTopRole;
    const changed = server.roles[index]?.id !== roleId;
    return !shouldMove && changed;
  });
  if (changingHigherPriorityRole) {
    return [null, generateError('Cannot move higher priority server role.')];
  }

  if (roleIds.length !== server.roles.length) {
    return [null, generateError('Role count does not match.')];
  }

  if (server.roles.filter((role) => roleIds.includes(role.id)).length !== roleIds.length) {
    return [null, generateError('Provide all role Ids to update the order.')];
  }

  const defaultRoleOrderIndex = server.roles.findIndex((role) => role.id === server.defaultRoleId);
  const defaultRoleNewOrderIndex = roleIds.findIndex((roleId) => roleId === server.defaultRoleId);

  if (defaultRoleOrderIndex !== defaultRoleNewOrderIndex) {
    return [null, generateError('Cannot change default role order.')];
  }

  await prisma.$transaction(
    roleIds.map((roleId, index) =>
      prisma.serverRole.update({
        where: { id: roleId },
        data: { order: index + 1 },
      })
    )
  );
  await deleteAllServerMemberCache(serverId);
  emitServerRoleOrderUpdated(serverId, roleIds);

  return [true, null];
};
