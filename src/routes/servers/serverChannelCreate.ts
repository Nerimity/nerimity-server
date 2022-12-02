import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { createServerChannel } from '../../services/Channel';

export function serverChannelCreate(Router: Router) {
  Router.post('/servers/:serverId/channels', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    route
  );
}




async function route (req: Request, res: Response) {


  const [newChannel, error] = await createServerChannel(req.serverCache.id, 'New Channel', req.accountCache.user.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(newChannel);
}