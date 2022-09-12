import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { emitServerMemberUpdated } from '../emits/Server';

export interface UpdateServerMember {
  roleIds?: string[]
}

export const updateServerMember = async (serverId: string, userId: string, update: UpdateServerMember): Promise<CustomResult<UpdateServerMember, CustomError>> => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  const member = await prisma.serverMember.findFirst({where: {serverId, userId: userId}});
  if (!member) {
    return [null, generateError('Member is not in this server.')];
  }
  if (update.roleIds) {
    // check if roles are inside the server.
    const roleCount = await prisma.serverRole.count({where: {id: {in: update.roleIds, not: server.defaultRoleId}, serverId}});
    if (roleCount !== update.roleIds.length) {
      return [null, generateError('One or more roles do not exist or cannot be applied to this member.', 'roleIds')];
    }
  }


  
  await prisma.serverMember.update({where: {userId_serverId: {serverId, userId}}, data: update});


  emitServerMemberUpdated(serverId, userId, update);


  return [update, null];

};