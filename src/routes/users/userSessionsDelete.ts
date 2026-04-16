import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { destroySession } from '../../services/User/UserManagement';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '@src/common/errorHandler';

export function userSessionsDelete(Router: Router) {
  Router.delete(
    '/users/sessions/:sessionId?',
    authenticate(),
    rateLimit({
      name: 'account_sessions_delete',
      restrictMS: 60000,
      requests: 20,
    }),
    body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').not().isEmpty().withMessage('Password required!').isString().withMessage('Password must be a string.'),

    route,
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const sessionId = req.params.sessionId;
  const password = req.body.password;

  const [result, err] = await destroySession(req.userCache.id, sessionId!, password);

  if (err) {
    return res.status(400).json(err);
  }

  res.json(result);
}
