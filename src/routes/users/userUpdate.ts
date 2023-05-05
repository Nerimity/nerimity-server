import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateUser } from '../../services/User';

export function userUpdate(Router: Router) {
  Router.post('/users',
    authenticate(),
    rateLimit({
      name: 'user_update_limit',
      expireMS: 60000,
      requestCount: 5,
    }),
    body('email')
      .isEmail().withMessage('Invalid email.')
      .isLength({ min: 1, max: 320 }).withMessage('Email must be between 1 and 320 characters long.').optional({nullable: true }),
    body('username')
      .isString().withMessage('Invalid username.')
      .not().contains('@').withMessage('Username cannot contain the @ symbol')
      .not().contains(':').withMessage('Username cannot contain the : symbol')
      .isLength({ min: 3, max: 35 }).withMessage('Username must be between 3 and 35 characters long.').optional({nullable: true }),
    body('tag')
      .isString().withMessage('Invalid tag.')
      .isAlphanumeric().withMessage('Tag must be alphanumerical!')
      .isLength({ min: 4, max: 4 }).withMessage('Tag must be 4 characters long').optional({nullable: true }),
    body('password')
      .isString().withMessage('Password must be a string.')
      .isLength({ min: 4, max: 255 }).withMessage('Password must be between 4 and 255 characters long.').optional({nullable: true }),
    route
  );
}

interface Body {
  email?: string;
  username?: string;
  tag?: string;
  password?: string;
  avatar?: string;
  banner?: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [result, error] = await updateUser({
    userId: req.accountCache.user.id,
    email: body.email,
    username: body.username,
    tag: body.tag,
    password: body.password,
    avatar: body.avatar,
    banner: body.banner
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}