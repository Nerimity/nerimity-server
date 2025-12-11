import { Request, Response, Router } from 'express';
import { getAllConnectedUserIds } from '../../cache/UserCache';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getUsersOnline(Router: Router) {
  Router.get('/moderation/online-users', authenticate(), isModMiddleware(), route);
}

async function route(req: Request, res: Response) {
  const connectedUserIds = await getAllConnectedUserIds();

  let sort = req.query.sort as 'desc' | 'asc';

  if (!sort || !['desc', 'asc'].includes(sort)) {
    sort = 'desc';
  }

  const users = await prisma.user.findMany({
    where: { id: { in: connectedUserIds as string[] } },
    orderBy: {
      joinedAt: sort,
    },
    select: {
      id: true,
      username: true,
      joinedAt: true,
      tag: true,
      hexColor: true,
      bot: true,
      avatar: true,
      badges: true,
    },
  });

  res.json(users);
}
