import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';
import { resetPassword } from '../../services/User/UserManagement';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function userPasswordReset(Router: Router) {
  Router.post(
    '/users/reset-password',

    body('newPassword')
    .not()
    .isEmpty()
    .withMessage('newPassword is required.')
    .isString()
    .withMessage('New password must be a string.')
    .isLength({ min: 4, max: 64 })
    .withMessage('New password must be between 4 and 64 characters long.'),

    rateLimit({
      name: 'reset_password',
      restrictMS: 30000, // 30 seconds
      requests: 8,
      useIP: true,
    }),
    
    route
  );
}

async function route(req: Request, res: Response) {

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const code = req.query.code as string;
  const userId = req.query.userId as string;
  const newPassword = req.body.newPassword;

  const [newToken, error] = await resetPassword({
    code,
    newPassword,
    userId
  })

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ token: newToken });
}
