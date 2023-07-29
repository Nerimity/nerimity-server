import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { isExpired } from '../../services/User';

export function getUser(Router: Router) {
  Router.get(
    '/moderation/users/:userId',
    authenticate(),
    isModMiddleware,
    route
  );
}

async function route(req: Request, res: Response) {
  const userId = req.params.userId;

  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      suspension: true,
      profile: true,
      account: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!user) return null;

  if (!user.suspension?.expireAt) return res.json(user);
  if (!isExpired(user.suspension.expireAt)) return res.json(user);
  user.suspension = null;

  res.json(user);
}
