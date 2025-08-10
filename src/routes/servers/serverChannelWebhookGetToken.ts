import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getWebhookToken } from '../../services/Webhook';
import { BaseChannelCache, ServerChannelCache } from '../../cache/ChannelCache';

export function serverChannelWebhookToken(Router: Router) {
  Router.get(
    '/servers/:serverId/channels/:channelId/webhooks/:webhookId/token',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_channel_wh_token',
      restrictMS: 10000,
      requests: 5,
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

  const [token, error] = await getWebhookToken(channelCache.serverId, req.params.webhookId!);
  if (error) {
    return res.status(403).json(error);
  }
  res.json({ token });
}
