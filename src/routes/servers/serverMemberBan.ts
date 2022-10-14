import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { banServerMember } from '../../services/Server';

export function serverMemberBan(Router: Router) {
  Router.delete('/servers/:serverId/members/:userId/ban', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.BAN),
    rateLimit({
      name: 'server_ban_member',
      expireMS: 10000,
      requestCount: 30,
    }),
    route
  );
}


async function route (req: Request, res: Response) {

  const userId = req.params.userId as string;

  const [, error] = await banServerMember(userId, req.serverCache.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({status: true});    

}