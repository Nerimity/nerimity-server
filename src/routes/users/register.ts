import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { turnstileVerify } from '../../common/turnstileVerify';
import { rateLimit } from '../../middleware/rateLimit';
import { isIpBanned } from '../../services/User/User';
import { registerUser } from '../../services/UserAuthentication';

export function register(Router: Router) {
  Router.post(
    '/users/register',
    body('token')
      .isString()
      .withMessage('Token must be a string.')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Token must be between 1 and 5000 characters long.')
      .optional(true),
    body('email')
      .not()
      .isEmpty()
      .withMessage('Email is required.')
      .isEmail()
      .withMessage('Invalid email.')
      .isLength({ min: 1, max: 320 })
      .withMessage('Email must be between 1 and 320 characters long.'),
    body('username')
      .not()
      .isEmpty()
      .withMessage('Username is required.')
      .isString()
      .withMessage('Invalid username.')
      .not()
      .contains('@')
      .withMessage('Username cannot contain the @ symbol')
      .not()
      .contains(':')
      .withMessage('Username cannot contain the : symbol')
      .isLength({ min: 3, max: 35 })
      .withMessage('Username must be between 3 and 35 characters long.'),
    body('password')
      .not()
      .isEmpty()
      .withMessage('Password is required.')
      .isString()
      .withMessage('Password must be a string.')
      .isLength({ min: 4, max: 64 })
      .withMessage('Password must be between 4 and 64 characters long.'),
    rateLimit({
      name: 'register_limit',
      message: 'Something went wrong! Please try again in 1 minute.',
      globalLimit: true,
      restrictMS: 30000,
      requests: 5,
    }),
    route
  );
}

interface Body {
  email: string;
  username: string;
  password: string;
  token: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const validToken = await turnstileVerify(body.token);

  if (!validToken) {
    return res
      .status(401)
      .json(generateError('Invalid captcha! Please try again.', 'token'));
  }

  const ipBanned = await isIpBanned(req.userIP);
  if (ipBanned) {
    return res.status(401).json(generateError('You are IP banned.'));
  }

  const [userToken, errors] = await registerUser({
    email: body.email,
    username: body.username,
    password: body.password,
  });
  if (errors) {
    return res.status(400).json(errors);
  }
  res.json({ token: userToken });
}
