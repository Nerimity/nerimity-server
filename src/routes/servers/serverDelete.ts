import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteServer } from '../../services/Server';
import { Log } from '../../common/Log';

export function serverDelete(Router: Router) {
  Router.delete(
    '/servers/:serverId',
    authenticate(),
    serverMemberVerification(),
    route
  );
}

async function route(req: Request, res: Response) {
  if (req.serverCache.createdById !== req.userCache.id) {
    return res.status(403).json({
      error: 'Only the owner of the server can delete this server.',
    });
  }

  const [status, error] = await deleteServer(req.serverCache.id);
  if (error) {
    return res.status(500).json(error);
  }
  res.json({ status: true });
}
