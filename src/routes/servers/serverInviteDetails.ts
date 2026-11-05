import { Request, Response, Router } from 'express';
import { getServerDetailsByInviteCode } from '../../services/ServerInvite';
import { authenticate } from '@src/middleware/authenticate';

export function serverInviteDetails(Router: Router) {
  Router.get('/servers/invites/:inviteCode',
    authenticate({ allowNoToken: true }),
    route
  );
}

async function route(req: Request, res: Response) {
  const { inviteCode } = req.params;
  const [server, error] = await getServerDetailsByInviteCode(inviteCode, req?.userCache?.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}