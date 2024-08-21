import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { UserStatus } from '../../types/User';
import { updateUserPresence } from '../../services/User/User';
import { rateLimit } from '../../middleware/rateLimit';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';

export function userUpdatePresence(Router: Router) {
  Router.post(
    '/users/presence',
    authenticate({ allowBot: true }),
    body('status')
      .optional(true)
      .isNumeric()
      .withMessage('Invalid status.')
      .custom((val) => val >= 0 && val <= 4)
      .withMessage('Status must be between 0 and 4.'),
    body('custom').optional({ values: 'null' }).isString().withMessage('Invalid custom status.').isLength({ min: 0, max: 100 }).withMessage('custom status must be between 0 and 100.'),
    rateLimit({
      name: 'update_presence',
      restrictMS: 5000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  status?: UserStatus;
  custom?: string | null;
}

async function route(req: Request, res: Response) {
  const body: Body = req.body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (typeof body.custom === 'string' && !body.custom.trim()) {
    body.custom = null;
  }

  if (body.custom) {
    body.custom = body.custom.trim();
  }

  const [successMessage, error] = await updateUserPresence(req.userCache.id, {
    ...addToObjectIfExists('custom', body.custom),
    ...addToObjectIfExists('status', body.status),
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(successMessage);
}
