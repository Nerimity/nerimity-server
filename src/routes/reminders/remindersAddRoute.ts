import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { addReminder } from '../../services/Reminder';

export function remindersAddRoute(Router: Router) {
  Router.post(
    '/reminders',
    authenticate(),
    body('timestamp').not().isEmpty().withMessage('timestamp is required.').isNumeric().isLength({ min: 1, max: 255 }).withMessage('Invalid timestamp.'),

    body('postId').optional(true).isString().withMessage('postId must be a string').isLength({ min: 1, max: 255 }).withMessage('postId must be between 1 and 255 characters long'),
    body('messageId').optional(true).isString().withMessage('messageId must be a string').isLength({ min: 1, max: 255 }).withMessage('messageId must be between 1 and 255 characters long'),

    rateLimit({
      name: 'reminders_add',
      restrictMS: 60000,
      requests: 5,
    }),
    route
  );
}

interface Body {
  timestamp: number;
  postId?: string;
  messageId?: string;
}
async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!body.postId && !body.messageId) {
    return res.status(400).json('postId or messageId is required.');
  }

  const [reminder, error] = await addReminder({ userId: req.userCache.id, timestamp: body.timestamp, messageId: body.messageId, postId: body.postId });

  if (error) {
    return res.status(400).json(error);
  }

  return res.status(200).json(reminder);
}
