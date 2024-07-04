import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { verifyEmailConfirmCode } from '../../services/User/UserManagement';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { toggleFreeBadge } from '../../services/User/User';

export function userToggleBadge(Router: Router) {
  Router.post(
    '/users/badges/toggle',
    authenticate(),
    body('bit').not().isEmpty().withMessage('bit is required.').isNumeric().withMessage('bit must be a number.'),
    rateLimit({
      name: 'toggle_badge',
      restrictMS: 20000, // 20 seconds
      requests: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const { bit } = req.body;
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).end();
  }

  const [result, error] = await toggleFreeBadge(req.userCache.id, bit);

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}
