import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { upsertChannelNotice } from '../../services/Channel';

export function userChannelNoticeUpdate(Router: Router) {
  Router.put(
    '/users/channel-notice',
    authenticate({ allowBot: true }),
    body('content').trim().isString().withMessage('Content must be a string.').isLength({ min: 4, max: 300 }).withMessage('Content must be between 4 and 300 characters long.'),
    rateLimit({
      name: 'user_channel_notice_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  content: string;
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [notice, error] = await upsertChannelNotice(req.body.content, {
    userId: req.userCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ notice });
}
