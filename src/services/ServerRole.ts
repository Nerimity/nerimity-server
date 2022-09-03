import { prisma } from '../common/database';
import env from '../common/env';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';

export const createServerRole = async (name: string, creatorId: string, serverId: string) => {

  const roleCount = await prisma.serverRole.count({where: {serverId}});
  if (roleCount >= env.MAX_ROLES_PER_SERVER) {
    return [null, generateError('You already created the maximum amount of roles for this server.')];
  }

  const createdRole = prisma.serverRole.create({
    data: {
      id: generateId(),
      name,
      serverId,
      order: roleCount + 1,
      hexColor: env.DEFAULT_SERVER_ROLE_COLOR,

      createdById: creatorId,
    }
  });

};