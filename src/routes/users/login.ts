import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { rateLimit } from '../../middleware/rateLimit';
import {
  loginUserWithEmail,
  loginWithUsernameAndTag,
} from '../../services/UserAuthentication';

export function login(Router: Router) {
  Router.post(
    '/users/login',
    body('usernameAndTag')
      .optional(true)
      .isString()
      .withMessage('Invalid email.'),
    body('email').optional(true).isEmail().withMessage('Invalid email.'),
    body('password')
      .isLength({ min: 4, max: 72 })
      .withMessage('Password must be between 4 and 72 characters long.')
      .not()
      .isEmpty()
      .withMessage('Password is required.')
      .isString()
      .withMessage('Password must be a string.'),
    rateLimit({
      name: 'login',
      useIP: true,
      expireMS: 30000,
      requestCount: 10,
    }),
    route
  );
}

interface Body {
  email?: string;
  usernameAndTag?: string;
  password: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (body.usernameAndTag && body.email) {
    return res
      .status(400)
      .json(
        generateError('Only one of username:tag/email are required!', 'email')
      );
  }
  if (!body.usernameAndTag && !body.email) {
    return res
      .status(400)
      .json(generateError('username:tag/email required!', 'email'));
  }

  let username;
  let tag;

  if (!body.email && body.usernameAndTag) {
    const split = body.usernameAndTag.split(':');
    if (split.length !== 2)
      return res
        .status(400)
        .json(generateError('Invalid username & tag', 'email'));
    username = split[0];
    tag = split[1];
  }

  if (body.email) {
    const [userToken, error] = await loginUserWithEmail({
      email: body.email,
      password: body.password,
    });
    if (error) {
      return res.status(400).json(error);
    }
    res.json({ token: userToken });
  }

  if (username && tag) {
    const [userToken, error] = await loginWithUsernameAndTag({
      username,
      tag,
      password: body.password,
    });
    if (error) {
      return res.status(400).json(error);
    }
    res.json({ token: userToken });
  }
}
