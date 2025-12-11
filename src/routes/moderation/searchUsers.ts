import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { isExpired } from '../../services/User/User';

export function searchUsers(Router: Router) {
  Router.get('/moderation/users/search', authenticate(), isModMiddleware(), route);
}

async function route(req: Request, res: Response) {
  const search = req.query.q as string | undefined;
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  let users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: search, mode: 'insensitive' } }, { tag: { contains: search, mode: 'insensitive' } }, { id: search }, { servers: { some: { id: search } } }, { devices: { some: { ipAddress: { contains: search } } } }, { account: { email: { contains: search, mode: 'insensitive' } } }],
    },
    orderBy: {
      joinedAt: 'desc',
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    select: {
      id: true,
      username: true,
      joinedAt: true,
      tag: true,
      hexColor: true,
      avatar: true,
      badges: true,
      shadowBan: true,
      suspension: true,
    },
  });

  users = users.map((user) => {
    if (!user.suspension?.expireAt) return user;
    if (!isExpired(user.suspension.expireAt)) return user;
    user.suspension = null;
    return user;
  });

  res.json(users);
}
