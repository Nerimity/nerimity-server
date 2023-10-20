import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getAuditLogs(Router: Router) {
  Router.get('/moderation/audit-logs',
    authenticate(),
    isModMiddleware,
    route
  );
}

async function route(req: Request, res: Response) {
  const after = req.query.after as string | undefined;

  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }


  const logs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    include: {
      actionBy: true
    }
  });


  res.json(logs);
}