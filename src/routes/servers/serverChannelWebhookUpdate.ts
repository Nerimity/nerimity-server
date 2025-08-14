import { Request, Response, Router } from 'express';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { updateWebhook } from '../../services/Webhook';
import { BaseChannelCache, ServerChannelCache } from '../../cache/ChannelCache';
import { channelVerification } from '../../middleware/channelVerification';
import { body } from 'express-validator';

export function serverChannelWebhookUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/channels/:channelId/webhooks/:webhookId',
    authenticate({ allowBot: true }),

    body('name').isString().withMessage('Invalid name.').not().contains('@').withMessage('Name cannot contain the @ symbol').not().contains(':').withMessage('Name cannot contain the : symbol').isLength({ min: 3, max: 35 }).withMessage('Name must be between 3 and 35 characters long.').optional({ nullable: true }),

    serverMemberVerification(),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_channel_wh_update',
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

  const [webhook, error] = await updateWebhook(req.params.webhookId!, channelCache.serverId, { name: req.body.name });
  if (error) {
    return res.status(403).json(error);
  }

  res.json(webhook);
}
