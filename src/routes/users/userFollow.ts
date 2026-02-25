import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { followUser, updateUser } from '../../services/User/User';

export function userFollow(Router: Router) {
  Router.post(
    '/users/:userId/follow',
    authenticate(),
    rateLimit({
      name: 'user_follow',
      restrictMS: 60000,
      requests: 20,
    }),
    route,
  );
}

interface Params {
  userId: string;
}

async function route(req: Request, res: Response) {
  const body = req.params as unknown as Params;

  if (!req.userCache.account?.emailConfirmed) {
    return res.status(400).json(generateError('You must confirm your email to follow users.'));
  }

  const [, error] = await followUser(req.userCache.id, body.userId);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status: true });
}
