import { Request, Response, Router } from 'express';

import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteChannelNotice } from '../../services/Channel';
import { channelVerification } from '../../middleware/channelVerification';

export function serverChannelNoticeDelete(Router: Router) {
  Router.delete(
    '/servers/:serverId/channels/:channelId/notice',
    authenticate(),
    serverMemberVerification(),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    rateLimit({
      name: 'server_channel_notice_delete',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {

  const [status, error] = await deleteChannelNotice({ channelId: req.channelCache.id });
  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
