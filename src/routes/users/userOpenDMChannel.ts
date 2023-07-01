import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { openDMChannel } from '../../services/User';

export function userOpenDMChannel(Router: Router) {
  Router.post(
    '/users/:userId/open-channel',
    authenticate(),
    param('userId')
      .not()
      .isEmpty()
      .withMessage('userId is required.')
      .isString()
      .withMessage('Invalid userId.')
      .isLength({ min: 1, max: 320 })
      .withMessage('userId must be between 1 and 320 characters long.'),
    rateLimit({
      name: 'open_dm_channel',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [inbox, error] = await openDMChannel(
    req.accountCache.user.id,
    req.params.userId
  );
  if (error) {
    return res.status(400).json(error);
  }
  res.json(inbox);
}
