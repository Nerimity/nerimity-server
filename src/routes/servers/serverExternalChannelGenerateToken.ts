import { Request, Response, Router } from 'express';

import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { channelVerification } from '../../middleware/channelVerification';
import { generateExternalServerChannelToken } from '../../services/ExternalServerChannel';

export function serverExternalChannelGenerateToken(Router: Router) {
  Router.post(
    '/servers/:serverId/channels/:channelId/external/generate-token',
    authenticate(),
    serverMemberVerification(),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_channel_generate_token',
      restrictMS: 10000,
      requests: 2,
    }),
    route
  );
}

async function route(req: Request<unknown, unknown, unknown>, res: Response) {
  const [token, error] = await generateExternalServerChannelToken(req.channelCache.id);
  if (error) {
    return res.status(400).json(error);
  }

  res.json({ token });
}
