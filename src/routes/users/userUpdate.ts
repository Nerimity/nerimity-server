import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import { updateUser } from '../../services/User/updateUser';
import { updateBot } from '../../services/Application';

export function userUpdate(Router: Router) {
  Router.post(
    '/users',
    authenticate(),
    rateLimit({
      name: 'user_update_limit',
      expireMS: 60000,
      requestCount: 10,
    }),
    body('email')
      .isEmail()
      .withMessage('Invalid email.')
      .isLength({ min: 1, max: 320 })
      .withMessage('Email must be between 1 and 320 characters long.')
      .optional({ nullable: true }),
    body('username')
      .isString()
      .withMessage('Invalid username.')
      .not()
      .contains('@')
      .withMessage('Username cannot contain the @ symbol')
      .not()
      .contains(':')
      .withMessage('Username cannot contain the : symbol')
      .isLength({ min: 3, max: 35 })
      .withMessage('Username must be between 3 and 35 characters long.')
      .optional({ nullable: true }),
    body('tag')
      .isString()
      .withMessage('Invalid tag.')
      .isAlphanumeric()
      .withMessage('Tag must be alphanumerical!')
      .isLength({ min: 4, max: 4 })
      .withMessage('Tag must be 4 characters long')
      .optional({ nullable: true }),
    body('password')
      .isString()
      .withMessage('Password must be a string.')
      .optional({ nullable: true }),
    body('newPassword')
      .isString()
      .withMessage('New password must be a string.')
      .isLength({ min: 4, max: 64 })
      .withMessage('New password must be between 4 and 64 characters long.')
      .optional({ nullable: true }),
    body('socketId')
      .isString()
      .withMessage('socketId must be a string.')
      .isLength({ min: 4, max: 164 })
      .withMessage('socketId must be between 4 and 255 characters long.')
      .optional({ nullable: true }),
    body('bio')
      .isString()
      .withMessage('Bio must be a string.')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Bio must be between 1 and 1000 characters long.')
      .optional({ nullable: true }),
    body('dmStatus')
      .isInt({ min: 0, max: 2 })
      .withMessage('dmStatus must be a number.')
      .optional({ nullable: true }),
    body('friendRequestStatus')
      .isInt({ min: 0, max: 2 })
      .withMessage('friendRequestStatus must be a number.')
      .optional({ nullable: true }),
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
  avatarPoints?: number[];
  banner?: string;
  bio?: string | null;
  socketId?: string;
  dmStatus?: number;
  friendRequestStatus?: number;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.userCache.bot) {

    const [result, error] = await updateBot({
      ...body,
      userId: req.userCache.id,
    })

    if (error) {
      return res.status(400).json(error);
    }
  
    return res.json(result);

  }

  const [result, error] = await updateUser({
    userId: req.userCache.id,
    socketId: body.socketId,
    email: body.email,
    username: body.username,
    tag: body.tag,
    password: body.password,
    avatar: body.avatar,
    avatarPoints: body.avatarPoints,
    banner: body.banner,
    newPassword: body.newPassword,
    ...addToObjectIfExists('dmStatus', body.dmStatus),
    ...addToObjectIfExists('friendRequestStatus', body.friendRequestStatus),
    ...(body.bio !== undefined
      ? {
          profile: {
            bio: body.bio,
          },
        }
      : undefined),
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}
