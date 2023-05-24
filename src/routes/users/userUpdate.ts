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
      .optional({nullable: true }),
    body('newPassword')
      .isString().withMessage('New password must be a string.')
      .isLength({ min: 4, max: 255 }).withMessage('New password must be between 4 and 255 characters long.').optional({nullable: true }),
    body('socketId')
      .isString().withMessage('socketId must be a string.')
      .isLength({ min: 4, max: 164 }).withMessage('socketId must be between 4 and 255 characters long.').optional({nullable: true }),
    body('bio')
      .isString().withMessage('Bio must be a string.')
      .isLength({ min: 1, max: 1000 }).withMessage('Bio must be between 1 and 1000 characters long.').optional({nullable: true }),
    route
  );
}

interface Body {
  email?: string;
  username?: string;
  tag?: string;
  password?: string;
  newPassword?: string;
  avatar?: string;
  banner?: string;
  bio?: string | null;
  socketId?: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [result, error] = await updateUser({
    userId: req.accountCache.user.id,
    socketId: body.socketId,
    email: body.email,
    username: body.username,
    tag: body.tag,
    password: body.password,
    avatar: body.avatar,
    banner: body.banner,
    newPassword: body.newPassword,
    ...(body.bio !== undefined ? { 
      profile: {
        bio: body.bio
      }
    } : undefined)
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}