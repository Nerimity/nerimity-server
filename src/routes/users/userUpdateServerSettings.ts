import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import {
  ServerNotificationPingMode,
  ServerNotificationSoundMode,
  UpdateServerSettings,
} from '../../services/User/User';

import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';

export function userUpdateServerSettings(Router: Router) {
  Router.post(
    '/users/servers/:serverId',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'user_server_update_limit',
      expireMS: 10000,
      requestCount: 20,
    }),
    body('notificationSoundMode')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 2 })
      .withMessage('Invalid notificationSoundMode.'),
    body('notificationPingMode')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 2 })
      .withMessage('Invalid notificationPingMode.'),
    route
  );
}

interface Body {
  notificationSoundMode: ServerNotificationSoundMode;
  notificationPingMode: ServerNotificationPingMode;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  await UpdateServerSettings(req.accountCache.user.id, req.serverCache.id, {
    ...addToObjectIfExists('notificationSoundMode', body.notificationSoundMode),
    ...addToObjectIfExists('notificationPingMode', body.notificationPingMode),
  });

  res.json({ status: 'done' });
}
