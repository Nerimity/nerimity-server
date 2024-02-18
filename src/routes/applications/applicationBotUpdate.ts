import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getApplication, updateBot } from '../../services/Application';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { body } from 'express-validator';

export function applicationBotUpdate(Router: Router) {
  Router.patch(
    '/applications/:id/bot',
    body('username')
      .isString()
      .withMessage('Invalid username.')
      .not()
      .contains('@')
      .withMessage('Username cannot contain the @ symbol')
      .not()
      .contains(':')
      .withMessage('Username cannot contain the : symbol')
      .isLength({ min: 3, max: 35 })
      .withMessage('Username must be between 3 and 35 characters long.')
      .optional({ nullable: true }),
    body('tag')
      .isString()
      .withMessage('Invalid tag.')
      .isAlphanumeric()
      .withMessage('Tag must be alphanumerical!')
      .isLength({ min: 4, max: 4 })
      .withMessage('Tag must be 4 characters long')
      .optional({ nullable: true }),

    authenticate(),
    rateLimit({
      name: 'update-app-bot',
      expireMS: 60000,
      requestCount: 5,
    }),
    route
  );
}

interface Body {
  email?: string;
  username?: string;
  tag?: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  const id = req.params.id;
  if (!id) {
    return res.status(400).json(generateError('Missing application id!'));
  }

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [application, error] = await getApplication(
    req.userCache.account.id,
    id
  );
  if (error) {
    return res.status(404).json(error);
  }
  if (!application.botUserId) {
    return res.status(400).json(generateError('You must create a bot first!'));
  }

  const [result, updateErr] = await updateBot({
    userId: application.botUserId,
    username: body.username,
    tag: body.tag,
  });

  if (updateErr) {
    return res.status(403).json(updateErr);
  }

  res.json(result);
}
