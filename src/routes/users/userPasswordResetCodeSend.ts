import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';
import { sendResetPasswordCode } from '../../services/User/UserManagement';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function userPasswordResetCodeSent(Router: Router) {
  Router.post(
    '/users/reset-password/send-code',

    body('email')
    .not().isEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email.'),

    rateLimit({
      name: 'reset_password_send_code',
      restrictMS: 60_000, // 1 minutes
      requests: 1,
    }),
    route
  );
}

interface Body {
  email: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [result, error] = await sendResetPasswordCode(body.email);

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}
