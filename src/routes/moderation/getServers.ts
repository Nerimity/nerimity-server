import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getServers(Router: Router) {
  Router.get('/moderation/servers', authenticate(), isModMiddleware, route);
}

async function route(req: Request, res: Response) {
  const after = req.query.after as string | undefined;

  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const users = await prisma.server.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    select: {
      scheduledForDeletion: true,
      name: true,
      hexColor: true,
      id: true,
      createdAt: true,
      createdBy: { select: { id: true, username: true, tag: true } },
      verified: true,
      avatar: true,
    },
  });

  res.json(users);
}
