import { deleteAllServerMemberCache } from '../cache/ServerMemberCache';
import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { ROLE_PERMISSIONS } from '../common/Permissions';
import { emitServerRoleCreated, emitServerRoleUpdated } from '../emits/Server';

export const createServerRole = async (name: string, creatorId: string, serverId: string) => {

  const roleCount = await prisma.serverRole.count({where: {serverId}});
  if (roleCount >= env.MAX_ROLES_PER_SERVER) {
    return [null, generateError('You already created the maximum amount of roles for this server.')];
  }

  const createdRole = await prisma.serverRole.create({
    data: {
      id: generateId(),
      name,
      serverId,
      permissions: ROLE_PERMISSIONS.SEND_MESSAGE.bit,
      order: roleCount + 1,
      hexColor: env.DEFAULT_SERVER_ROLE_COLOR,

      createdById: creatorId,
    }
  });

  emitServerRoleCreated(serverId, createdRole);

  return [createdRole, null];

};


export interface UpdateServerRoleOptions {
  name?: string;
  permissions?: number;
  hexColor?: string;
}

export const updateServerRole = async (serverId: string, roleId: string, update: UpdateServerRoleOptions): Promise<CustomResult<UpdateServerRoleOptions, CustomError>> => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const role = await prisma.serverRole.findFirst({where: {id: roleId, serverId: serverId}});
  if (!role) {
    return [null, generateError('Role does not exist.')];
  }

  await prisma.serverRole.update({where: {id: role.id}, data: update});

  await deleteAllServerMemberCache(serverId);

  emitServerRoleUpdated(serverId, roleId, update);


  return [update, null];

};