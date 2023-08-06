import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { leaveServer } from '../../services/Server';

export function serverLeave(Router: Router) {
  Router.post(
    '/servers/:serverId/leave',
    authenticate(),
    serverMemberVerification(),
    route
  );
}

async function route(req: Request, res: Response) {
  const [status, error] = await leaveServer(
    req.accountCache.user.id,
    req.serverCache.id
  );
  if (error) {
    return res.status(500).json(error);
  }
  res.json({ status: true });
}
