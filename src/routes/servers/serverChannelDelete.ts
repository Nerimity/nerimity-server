import { Request, Response, Router } from 'express';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteServerChannel } from '../../services/Channel';

export function serverChannelDelete(Router: Router) {
  Router.delete('/servers/:serverId/channels/:channelId', authenticate({ allowBot: true }), serverMemberVerification(), memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS), route);
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(403).json(bodyErrors);
  }

  const [done, error] = await deleteServerChannel(req.serverCache.id, req.params.channelId, req.userCache.id);
  if (error) {
    return res.status(403).json(error);
  }
  res.json({ deleted: done });
}
