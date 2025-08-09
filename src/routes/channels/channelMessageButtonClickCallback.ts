import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { buttonClick, buttonClickCallback } from '../../services/Message/Message';
import { body, oneOf } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function channelMessageButtonClickCallback(Router: Router) {
  Router.post(
    '/channels/:channelId/messages/:messageId/buttons/:buttonId/callback',
    authenticate({ allowBot: true }),
    channelVerification(),

    body('userId').isString().withMessage('userId must be a string').isLength({ min: 1, max: 255 }).withMessage('userId must be between 1 and 255 characters long'),

    body('title').optional(true).isString().withMessage('title must be a string').isLength({ min: 0, max: 100 }).withMessage('title length must be less than or equal to 100 characters'),

    body('content').optional(true).isString().withMessage('content must be a string').isLength({ min: 0, max: 500 }).withMessage('content length must be less than or equal to 500 characters'),

    rateLimit({
      name: 'button_click_callback',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

interface RequestParams {
  channelId: string;
  messageId: string;
  buttonId: string;
}

interface Body {
  userId: string;
  title?: string;
  content?: string;
}

async function route(req: Request, res: Response) {
  const { channelId, messageId, buttonId } = req.params as unknown as RequestParams;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [status, error] = await buttonClickCallback({
    channelId,
    messageId,
    buttonId,
    data: req.body as Body,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
