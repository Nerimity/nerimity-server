import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getServerDetailsByInviteCode, joinServerByInviteCode } from '../../services/ServerInvite';

export function serverInviteDetails(Router: Router) {
  Router.get('/servers/invites/:inviteCode', 
    route
  );
}

async function route (req: Request, res: Response) {
  const { inviteCode } = req.params;
  const [server, error] = await getServerDetailsByInviteCode(inviteCode);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}