import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import {
  NotificationPingMode,
  NotificationSoundMode,
  updateUserNotificationSettings,
} from '../../services/User/User';

import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';

export function userUpdateNotificationSettings(Router: Router) {
  Router.post(
    '/users/notifications',
    authenticate(),
    serverMemberVerification(),
    rateLimit({
      name: 'update_notification',
      expireMS: 10000,
      requestCount: 20,
    }),

    body('channelId')
      .optional({ nullable: true })
      .isString()
      .withMessage('Invalid channelId.')
      .isLength({ min: 3, max: 320 })
      .withMessage('Invalid channelId.'),
    body('serverId')
      .optional({ nullable: true })
      .isString()
      .withMessage('Invalid serverId.')
      .isLength({ min: 3, max: 320 })
      .withMessage('Invalid serverId.'),

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
  notificationSoundMode: (typeof NotificationSoundMode)[keyof typeof NotificationSoundMode];
  notificationPingMode: (typeof NotificationPingMode)[keyof typeof NotificationPingMode];
  channelId?: string;
  serverId?: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [result, error] = await updateUserNotificationSettings(
    req.userCache.id,
    {
      ...addToObjectIfExists(
        'notificationSoundMode',
        body.notificationSoundMode
      ),
      ...addToObjectIfExists('notificationPingMode', body.notificationPingMode),
    },
    body.channelId ? undefined : body.serverId,
    body.channelId
  );

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status: 'done' });
}
