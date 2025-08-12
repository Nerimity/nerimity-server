import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { deleteWebhook } from '../../services/Webhook';
import { BaseChannelCache, ServerChannelCache } from '../../cache/ChannelCache';
import { channelVerification } from '../../middleware/channelVerification';

export function serverChannelWebhookDelete(Router: Router) {
  Router.delete(
    '/servers/:serverId/channels/:channelId/webhooks/:webhookId',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_channel_wh_delete',
      restrictMS: 10000,
      requests: 20,
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

  const [status, error] = await deleteWebhook(channelCache.serverId, channelCache.id, req.params.webhookId!);
  if (error) {
    return res.status(403).json(error);
  }
  res.json({ status });
}
