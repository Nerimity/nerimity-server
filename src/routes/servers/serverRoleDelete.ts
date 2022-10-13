import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteServerRole } from '../../services/ServerRole';

export function serverRoleDelete(Router: Router) {
  Router.delete('/servers/:serverId/roles/:roleId', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.MANAGE_ROLES),
    route
  );
}




async function route (req: Request, res: Response) {

  const role = await prisma.serverRole.findFirst({where: {id: req.params.roleId}});
  if (!role) {
    return res.status(400).json(generateError('Role does not exist.'));
  }
  const isCreator = req.serverCache.createdById === req.accountCache.user.id;
  if (!isCreator && role.order >= req.serverMemberCache.topRoleOrder) {
    return res.status(400).json(generateError('You do not have priority to modify this role.'));
  }



  const [, error] = await deleteServerRole(req.serverCache.id, req.params.roleId);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(role);
}