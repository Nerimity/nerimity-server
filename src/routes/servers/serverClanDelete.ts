import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteClan } from '../../services/Server';

export function serverClanDelete(Router: Router) {
  Router.delete(
    '/servers/:serverId/clans',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'server_clan_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const [status, error] = await deleteClan({
    userId: req.userCache.id,
    serverId: req.serverCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status });
}
