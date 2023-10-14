import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { getServerEmojis } from '../../services/Server';

export function serverEmojisGet(Router: Router) {
  Router.get('/servers/:serverId/emojis',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_get_emojis',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}



async function route(req: Request, res: Response) {
  const [updated, error] = await getServerEmojis(req.serverCache.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}