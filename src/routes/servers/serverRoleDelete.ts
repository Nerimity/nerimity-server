import { Request, Response, Router } from 'express';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteServerRole } from '../../services/ServerRole';

export function serverRoleDelete(Router: Router) {
  Router.delete('/servers/:serverId/roles/:roleId', 
    authenticate(),
    serverMemberVerification(),
    route
  );
}




async function route (req: Request, res: Response) {

  const isServerCreator = req.serverCache.createdById === req.accountCache.user.id;

  if (!isServerCreator) {
    res.status(403).json(generateError('You are not allowed to perform this action'));
    return;
  }

  const [role, error] = await deleteServerRole(req.serverCache.id, req.params.roleId);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(role);
}