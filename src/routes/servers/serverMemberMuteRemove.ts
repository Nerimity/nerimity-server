import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { serverMemberRemoveMute } from '../../services/Server';

export function serverMemberMuteRemove(Router: Router) {
  Router.delete(
    '/servers/:serverId/mutes/:userId',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_unmute_member',
      restrictMS: 10000,
      requests: 80,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const userId = req.params.userId as string;

  const [, error] = await serverMemberRemoveMute(req.serverCache.id, userId, req.userCache.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status: true });
}
