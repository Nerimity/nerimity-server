import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { createServerRole } from '../../services/ServerRole';

export function serverRoleCreate(Router: Router) {
  Router.post('/servers/:serverId/roles', authenticate({ allowBot: true }), serverMemberVerification(), memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_ROLES), route);
}

async function route(req: Request, res: Response) {
  const [newRole, error] = await createServerRole('New Role', req.userCache.id, req.serverCache.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(newRole);
}
