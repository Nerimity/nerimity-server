import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { registerFCMToken } from '../../services/User';
import { rateLimit } from '../../middleware/rateLimit';

export function userRegisterFCM(Router: Router) {
  Router.post(
    '/users/register-fcm',
    authenticate(),
    rateLimit({
      name: 'register_fcm',
      expireMS: 60000,
      requestCount: 5,
    }),
    body('token').isString().withMessage('Invalid token'),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).end();
  }

  await registerFCMToken(req.accountCache.id, req.body.token);

  res.status(200).end();
}
