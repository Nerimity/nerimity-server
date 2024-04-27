import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteServerInvite } from '../../services/ServerInvite';

export function serverInviteDelete(Router: Router) {
  Router.delete(
    '/servers/:serverId/invites/:code',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'delete_server_invite',
      restrictMS: 20000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [_, error] = await deleteServerInvite(
    req.serverCache.id,
    req.params.code,
    req.userCache.id
  );

  if (error) {
    return res.status(403).json(error);
  }

  res.json({ status: true });
}
