import { Request, Response, Router } from 'express';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { createServerChannel } from '../../services/Channel';

export function serverChannelCreate(Router: Router) {
  Router.post('/servers/:serverId/channels', 
    authenticate(),
    serverMemberVerification(),
    route
  );
}




async function route (req: Request, res: Response) {

  const isServerCreator = req.serverCache.createdById === req.accountCache.user.id;

  if (!isServerCreator) {
    res.status(403).json(generateError('You are not allowed to perform this action'));
    return;
  }

  const [newChannel, error] = await createServerChannel(req.serverCache.id, 'New Channel', req.accountCache.user.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(newChannel);
}