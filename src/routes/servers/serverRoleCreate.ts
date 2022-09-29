import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Permissions';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { createServerRole } from '../../services/ServerRole';

export function serverRoleCreate(Router: Router) {
  Router.post('/servers/:serverId/roles', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.MANAGE_ROLES),
    route
  );
}




async function route (req: Request, res: Response) {

  const [newRole, error] = await createServerRole('New Role', req.accountCache.user.id, req.serverCache.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(newRole);
}