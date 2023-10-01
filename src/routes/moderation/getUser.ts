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
      devices: { orderBy: { createdAt: 'desc' } },
      servers: { select: { name: true, hexColor: true, id: true, createdAt: true, createdBy: { select: { id: true, username: true, tag: true } }, avatar: true } },
      account: {
        select: {
          suspendCount: true,
          email: true,
          emailConfirmCode: true,
          emailConfirmed: true,
        },
      },
    },
  });

  if (!user) return null;

  if (user.suspension?.expireAt && isExpired(user.suspension.expireAt)) {
    user.suspension = null;
  }

  res.json(user);
}
