import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { addFriend } from '../../services/Friend';

export function friendAdd(Router: Router) {
  Router.post(
    '/friends/add',
    authenticate(),
    body('username')
      .not()
      .isEmpty()
      .withMessage('Username is required.')
      .isString()
      .withMessage('Username must be a string.')
      .isLength({ min: 3, max: 320 })
      .withMessage('Username must be between 3 and 320 characters long.'),
    body('tag')
      .not()
      .isEmpty()
      .withMessage('tag is required.')
      .isString()
      .withMessage('tag must be a string.')
      .isLength({ min: 4, max: 4 })
      .withMessage('tag must be 4 characters long.'),
    rateLimit({
      name: 'add_friend',
      restrictMS: 30000,
      requests: 5,
    }),
    route
  );
}

interface Body {
  username: string;
  tag: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const userFriend = await prisma.user.findFirst({
    where: { username: body.username, tag: body.tag },
  });

  if (!userFriend?.id) {
    return res.status(400).json(generateError('User not found.'));
  }

  const [friend, error] = await addFriend(req.userCache.id, userFriend.id);
  if (error) {
    return res.status(400).json(error);
  }

  res.json(friend);
}
