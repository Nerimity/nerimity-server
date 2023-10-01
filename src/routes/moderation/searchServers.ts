import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function searchServers(Router: Router) {
  Router.get(
    '/moderation/servers/search',
    authenticate(),
    isModMiddleware,
    route
  );
}

async function route(req: Request, res: Response) {
  const search = req.query.q as string | undefined;
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const servers = await prisma.server.findMany({
    where: {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { id: search },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    select: { name: true, hexColor: true, id: true, createdAt: true, createdBy: { select: { id: true, username: true, tag: true } }, avatar: true }
  });

  res.json(servers);
}
