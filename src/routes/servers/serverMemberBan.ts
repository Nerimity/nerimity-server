import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { banServerMember } from '../../services/Server';
import { deleteRecentMessages } from '../../services/Message';

export function serverMemberBan(Router: Router) {
  // Router.delete('/servers/:serverId/members/:userId/ban', 
  Router.post('/servers/:serverId/bans/:userId',
    authenticate({allowBot: true}),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.BAN),
    rateLimit({
      name: 'server_ban_member',
      expireMS: 10000,
      requestCount: 30,
    }),
    route
  );
}

async function route(req: Request, res: Response) {

  const userId = req.params.userId as string;
  const shouldDeleteRecentMessages = req.query.shouldDeleteRecentMessages === 'true'; // Delete messages sent in the last 7 hours.

  const [, error] = await banServerMember(userId, req.serverCache.id, shouldDeleteRecentMessages);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status: true });

}