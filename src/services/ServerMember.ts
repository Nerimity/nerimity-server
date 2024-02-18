import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { emitServerMemberUpdated } from '../emits/Server';
import { arrayDiff, removeDuplicates } from '../common/utils';
import { deleteAllServerMemberCache } from '../cache/ServerMemberCache';
import { ServerRole } from '@prisma/client';
import { generateId } from '../common/flakeId';
import { addToObjectIfExists } from '../common/addToObjectIfExists';

export const getTopRole = async (
  serverId: string,
  userId: string
): Promise<CustomResult<ServerRole, CustomError>> => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    select: { defaultRoleId: true },
  });
  if (!server) {
    return [null, generateError('Server not found.')];
  }
  const member = await prisma.serverMember.findFirst({
    where: { serverId, userId },
    select: { roleIds: true },
  });
  if (!member) {
    return [null, generateError('Member not found.')];
  }
  member.roleIds.push(server.defaultRoleId);
  const role = await prisma.serverRole.findFirst({
    where: { id: { in: member.roleIds } },
    orderBy: { order: 'desc' },
  });
  return [role!, null];
};

export interface UpdateServerMember {
  roleIds?: string[];
}

export const updateServerMember = async (
  serverId: string,
  userId: string,
  updatedByUserId: string,
  update: UpdateServerMember
): Promise<CustomResult<UpdateServerMember, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  const member = await prisma.serverMember.findFirst({
    where: { serverId, userId: userId },
  });
  if (!member) {
    return [null, generateError('Member is not in this server.')];
  }

  if (update.roleIds) {
    const [currentTopRole, error] = await getTopRole(serverId, updatedByUserId);
    if (error) return [null, error];

    update.roleIds = removeDuplicates(update.roleIds);

    if (update.roleIds.includes(server.defaultRoleId)) {
      return [null, generateError('Cannot apply default role.')];
    }

    // check if roles are inside the server.
    const newRoles = await prisma.serverRole.findMany({
      where: {
        id: { in: update.roleIds, not: server.defaultRoleId },
        serverId,
      },
      orderBy: { order: 'desc' },
    });
    if (newRoles.length !== update.roleIds.length) {
      return [
        null,
        generateError(
          'One or more roles do not exist or cannot be applied to this member.',
          'roleIds'
        ),
      ];
    }

    const oldRoles = await prisma.serverRole.findMany({
      where: {
        id: { in: member.roleIds, not: server.defaultRoleId },
        serverId,
      },
      orderBy: { order: 'desc' },
    });

    const topRoleOrder = currentTopRole.order;

    const removedRoles = arrayDiff<ServerRole[]>(oldRoles, newRoles, 'order');
    const addedRoles = arrayDiff<ServerRole[]>(newRoles, oldRoles, 'order');

    const removedRolePermission = removedRoles.length
      ? removedRoles[0].order >= topRoleOrder
      : false;
    const addedRolePermission = addedRoles.length
      ? addedRoles[0].order >= topRoleOrder
      : false;

    // check if updater has higher role order to add the role.
    if (
      server.createdById !== updatedByUserId &&
      (removedRolePermission || addedRolePermission)
    ) {
      return [
        null,
        generateError(
          "One or more roles cannot be applied because you don't have priority.",
          'roleIds'
        ),
      ];
    }

    if (removedRoles.find((role) => role.botRole)) {
      return [null, generateError('Cannot remove bot role.', 'roleIds')];
    }
    if (addedRoles.find((role) => role.botRole)) {
      return [null, generateError('Cannot add bot role.', 'roleIds')];
    }
  }

  await prisma.serverMember.update({
    where: { userId_serverId: { serverId, userId } },
    data: update,
  });

  deleteAllServerMemberCache(serverId);

  emitServerMemberUpdated(serverId, userId, update);

  return [update, null];
};
