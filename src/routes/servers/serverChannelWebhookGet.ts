import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getWebhooks } from '../../services/Webhook';
import { BaseChannelCache, ServerChannelCache } from '../../cache/ChannelCache';

export function serverChannelWebhookGet(Router: Router) {
  Router.get(
    '/servers/:serverId/channels/:channelId/webhooks',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_channel_wh_get',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(403).json(bodyErrors);
  }

  const channelCache = req.channelCache as ServerChannelCache & BaseChannelCache;

  const webhooks = await getWebhooks(channelCache.serverId, channelCache.id);

  res.json(webhooks);
}
