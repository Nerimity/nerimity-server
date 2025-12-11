import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function searchAuditLogs(Router: Router) {
  Router.get('/moderation/audit-logs/search', authenticate(), isModMiddleware(), route);
}

async function route(req: Request, res: Response) {
  const search = req.query.q as string | undefined;

  const after = req.query.after as string | undefined;

  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const logs = await prisma.modAuditLog.findMany({
    where: {
      OR: [{ serverId: search }, { userId: search }, { actionById: search }],
    },
    orderBy: {
      createdAt: 'desc',
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    include: {
      actionBy: true,
    },
  });

  res.json(logs);
}
