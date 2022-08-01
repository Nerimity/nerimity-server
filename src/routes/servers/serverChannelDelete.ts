import { Request, Response, Router } from 'express';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteServerChannel } from '../../services/Channel';

export function serverChannelDelete(Router: Router) {
  Router.delete('/servers/:serverId/channels/:channelId', 
    authenticate(),
    serverMemberVerification(),
    route
  );
}



async function route (req: Request, res: Response) {

  const isServerCreator = req.serverCache.createdBy === req.accountCache.user._id;

  if (!isServerCreator) {
    res.status(403).json(generateError('You are not allowed to perform this action'));
    return;
  }

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(403).json(bodyErrors);
  }

  const [done, error] = await deleteServerChannel(req.serverCache._id, req.params.channelId);
  if (error) {
    return res.status(403).json(error);
  }
  res.json({deleted: done});

}