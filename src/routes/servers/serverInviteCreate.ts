import { Request, Response, Router } from 'express';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/ServerMemberVerification';
import { createServerInvite } from '../../services/ServerInvite';

export function serverInviteCreate(Router: Router) {
  Router.post('/servers/:serverId/invites', 
    authenticate(),
    serverMemberVerification(),
    route
  );
}



async function route (req: Request, res: Response) {

  const [invite, error] = await createServerInvite(req.serverCache._id, req.accountCache.user._id);

  if (error) {
    return res.status(403).json(error);
  }

  res.json(invite);

}