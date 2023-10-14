import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerChannelOrder } from '../../services/Server';

export function serverChannelUpdateOrder(Router: Router) {
  Router.post('/servers/:serverId/channels/order',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    body('channelIds')
      .isArray().withMessage('channelIds must be an array.'),
    body('categoryId')
      .isString().withMessage('channelIds must be a string.')
      .optional(),
    rateLimit({
      name: 'server_channel_update_order',
      expireMS: 10000,
      requestCount: 50,
    }),
    route
  );
}

interface Body {
  channelIds: string[];
  categoryId?: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [updated, error] = await updateServerChannelOrder({
    serverId: req.serverCache.id,
    orderedChannelIds: body.channelIds,
    categoryId: body.categoryId,
  });

  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}