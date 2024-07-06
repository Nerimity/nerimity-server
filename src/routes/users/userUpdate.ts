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
    authenticate({ allowBot: true }),
    rateLimit({
      name: 'user_update_limit',
      restrictMS: 60000,
      requests: 10,
    }),
    body('email').isEmail().withMessage('Invalid email.').isLength({ min: 1, max: 320 }).withMessage('Email must be between 1 and 320 characters long.').optional({ nullable: true }),
    body('username').isString().withMessage('Invalid username.').not().contains('@').withMessage('Username cannot contain the @ symbol').not().contains(':').withMessage('Username cannot contain the : symbol').isLength({ min: 3, max: 35 }).withMessage('Username must be between 3 and 35 characters long.').optional({ nullable: true }),
    body('tag').isString().withMessage('Invalid tag.').isAlphanumeric().withMessage('Tag must be alphanumerical!').isLength({ min: 4, max: 4 }).withMessage('Tag must be 4 characters long').optional({ nullable: true }),
    body('password').isString().withMessage('Password must be a string.').optional({ nullable: true }),
    body('newPassword').isString().withMessage('New password must be a string.').isLength({ min: 4, max: 64 }).withMessage('New password must be between 4 and 64 characters long.').optional({ nullable: true }),
    body('socketId').isString().withMessage('socketId must be a string.').isLength({ min: 4, max: 164 }).withMessage('socketId must be between 4 and 255 characters long.').optional({ nullable: true }),

    body('bio').isString().withMessage('Bio must be a string.').isLength({ min: 1, max: 1000 }).withMessage('Bio must be between 1 and 1000 characters long.').optional({ nullable: true }),
    body('bgColorOne').isString().withMessage('bgColorOne must be a string.').isLength({ min: 4, max: 100 }).optional({ nullable: true }),
    body('bgColorTwo').isString().withMessage('bgColorTwo must be a string.').isLength({ min: 4, max: 100 }).optional({ nullable: true }),
    body('primaryColor').isString().withMessage('primaryColor must be a string.').isLength({ min: 4, max: 100 }).optional({ nullable: true }),

    body('dmStatus').isInt({ min: 0, max: 2 }).withMessage('dmStatus must be a number.').optional({ nullable: true }),
    body('friendRequestStatus').isInt({ min: 0, max: 2 }).withMessage('friendRequestStatus must be a number.').optional({ nullable: true }),
    body('lastOnlineStatus').isInt({ min: 0, max: 2 }).withMessage('friendRequestStatus must be a number.').optional({ nullable: true }),

    body('hideFollowing').isBoolean().withMessage('hideFollowing must be a boolean.').optional({ nullable: true }),
    body('hideFollowers').isBoolean().withMessage('hideFollowers must be a boolean.').optional({ nullable: true }),
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
  socketId?: string;
  dmStatus?: number;
  friendRequestStatus?: number;

  lastOnlineStatus?: number;

  bio?: string | null;
  bgColorOne?: string | null;
  bgColorTwo?: string | null;
  primaryColor?: string | null;

  hideFollowing?: boolean;
  hideFollowers?: boolean;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const profile = {
    ...(body.bio !== undefined ? { bio: body.bio } : {}),
    ...(body.bgColorOne !== undefined ? { bgColorOne: body.bgColorOne } : {}),
    ...(body.bgColorTwo !== undefined ? { bgColorTwo: body.bgColorTwo } : {}),
    ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {}),
  };

  if (req.userCache.bot) {
    const [result, error] = await updateBot({
      ...body,
      userId: req.userCache.id,
      ...(Object.keys(profile).length
        ? {
            profile,
          }
        : {}),
    });

    if (error) {
      return res.status(400).json(error);
    }

    return res.json({ user: result });
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
    ...addToObjectIfExists('hideFollowing', body.hideFollowing),
    ...addToObjectIfExists('hideFollowers', body.hideFollowers),
    ...addToObjectIfExists('dmStatus', body.dmStatus),
    ...addToObjectIfExists('friendRequestStatus', body.friendRequestStatus),
    ...addToObjectIfExists('lastOnlineStatus', body.lastOnlineStatus),
    ...(Object.keys(profile).length
      ? {
          profile,
        }
      : {}),
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}
