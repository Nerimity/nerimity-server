import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { serverMemberBans } from '../../services/Server';

export function serverMemberBanList(Router: Router) {
  Router.get('/servers/:serverId/bans',
    authenticate({allowBot: true}),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.BAN),
    rateLimit({
      name: 'server_ban_member_list',
      restrictMS: 10000,
      requests: 30,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const list = await serverMemberBans(req.serverCache.id);
  res.json(list);
}