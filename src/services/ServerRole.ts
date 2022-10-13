import { deleteAllServerMemberCache } from '../cache/ServerMemberCache';
import { CustomResult } from '../common/CustomResult';
import { prisma, removeRoleIdFromServerMembers } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { ROLE_PERMISSIONS } from '../common/Bitwise';
import { emitServerRoleCreated, emitServerRoleDeleted, emitServerRoleUpdated } from '../emits/Server';

export const createServerRole = async (name: string, creatorId: string, serverId: string) => {

  const server = await prisma.server.findFirst({where: {id: serverId}, select: {defaultRoleId: true}});

  const roleCount = await prisma.serverRole.count({where: {serverId}});
  if (roleCount >= env.MAX_ROLES_PER_SERVER) {
    return [null, generateError('You already created the maximum amount of roles for this server.')];
  }

  const roles = await prisma.serverRole.findMany({where: {serverId, id: {not: server?.defaultRoleId}}, orderBy: {order: 'asc'}});

  const transactions = [
    prisma.serverRole.create({
      data: {
        id: generateId(),
        name,
        serverId,
        permissions: ROLE_PERMISSIONS.SEND_MESSAGE.bit,
        order: 2,
        hexColor: env.DEFAULT_SERVER_ROLE_COLOR,
  
        createdById: creatorId,
      }
    })
  ];
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    transactions.push(prisma.serverRole.update({where: {id: role.id}, data: {order: i + 3}}));
  }

  const [createdRole] = await prisma.$transaction(transactions);

  emitServerRoleCreated(serverId, createdRole);

  return [createdRole, null];

};


export interface UpdateServerRoleOptions {
  name?: string;
  permissions?: number;
  hexColor?: string;
  hideRole?: boolean;
}

export const updateServerRole = async (serverId: string, roleId: string, update: UpdateServerRoleOptions): Promise<CustomResult<UpdateServerRoleOptions, CustomError>> => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const role = await prisma.serverRole.findFirst({where: {id: roleId, serverId}});
  if (!role) {
    return [null, generateError('Role does not exist.')];
  }

  if (role.id === server.defaultRoleId) {
    if (update.hideRole !== undefined) {
      return [null, generateError('Cannot hide default role.')];
    }
  }


  await prisma.serverRole.update({where: {id: role.id}, data: update});

  await deleteAllServerMemberCache(serverId);

  emitServerRoleUpdated(serverId, roleId, update);
  
  
  return [update, null];
  
};


export const deleteServerRole = async (serverId: string, roleId: string) => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  const role = await prisma.serverRole.findFirst({where: {id: roleId, serverId}});
  if (!role) {
    return [null, generateError('Role does not exist.')];
  }

  if (server.defaultRoleId === role.id) {
    return [null, generateError('Cannot delete default role.')];
  }

  let serverRoles = await prisma.serverRole.findMany({where: {serverId}, orderBy: {order: 'asc'}});
  serverRoles = serverRoles.filter(role => role.id !== roleId); 

  const transactions = [
    removeRoleIdFromServerMembers(roleId),
    prisma.serverRole.delete({where: {id: roleId}})
  ];

  for (let i = 0; i < serverRoles.length; i++) {
    const role = serverRoles[i];
    transactions.push(prisma.serverRole.update({where: {id: role.id}, data: {order: i + 1}}));
  }
  
  await prisma.$transaction(transactions);

  deleteAllServerMemberCache(serverId);
  emitServerRoleDeleted(serverId, roleId);
  return [role, null];

};