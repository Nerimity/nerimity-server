import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { getServerInvitesByServerId } from '../../services/ServerInvite';

export function serverInvites(Router: Router) {
  Router.get('/servers/:serverId/invites', 
    authenticate(),
    serverMemberVerification(),
    route
  );
}



async function route (req: Request, res: Response) {

  const isServerCreator = req.serverCache.createdById === req.accountCache.user.id;

  const invites = await getServerInvitesByServerId(req.serverCache.id, !isServerCreator ? req.accountCache.user.id : undefined);

  res.json(invites);

}