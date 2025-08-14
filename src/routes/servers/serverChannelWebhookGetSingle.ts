import { Request, Response, Router } from 'express';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getWebhook } from '../../services/Webhook';
import { BaseChannelCache, ServerChannelCache } from '../../cache/ChannelCache';
import { channelVerification } from '../../middleware/channelVerification';

export function serverChannelWebhookGetSingle(Router: Router) {
  Router.get(
    '/servers/:serverId/channels/:channelId/webhooks/:webhookId',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_channel_wh_get-s',
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

  const webhook = await getWebhook(channelCache.serverId, channelCache.id);

  if (!webhook) {
    return res.status(404).json(generateError('Webhook not found.'));
  }

  res.json(webhook);
}
