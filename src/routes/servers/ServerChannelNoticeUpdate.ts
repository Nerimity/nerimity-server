import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
} from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { upsertChannelNotice } from '../../services/Channel';
import { channelVerification } from '../../middleware/channelVerification';

export function serverChannelNoticeUpdate(Router: Router) {
  Router.put(
    '/servers/:serverId/channels/:channelId/notice',
    authenticate(),
    serverMemberVerification(),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    body('content')
      .trim()
      .isString()
      .withMessage('Content must be a string.')
      .isLength({ min: 4, max: 300 })
      .withMessage('Content must be between 4 and 300 characters long.'),
    rateLimit({
      name: 'server_channel_notice_update',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}

interface Body {
  content: string
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [notice, error] = await upsertChannelNotice(req.body.content, {
    channelId: req.channelCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ notice });
}
