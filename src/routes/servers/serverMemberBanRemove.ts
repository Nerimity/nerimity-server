import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { serverMemberRemoveBan } from '../../services/Server';

export function serverMemberBanRemove(Router: Router) {
  Router.delete('/servers/:serverId/bans/:userId', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.BAN),
    rateLimit({
      name: 'server_ban_member',
      expireMS: 10000,
      requestCount: 80,
    }),
    route
  );
}

async function route (req: Request, res: Response) {
  const userId = req.params.userId as string;

  const [, error] = await serverMemberRemoveBan(req.serverCache.id, userId);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({status: true});    

}