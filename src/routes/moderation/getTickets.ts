import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { TicketStatus } from '../../services/Ticket';
export function getTickets(Router: Router) {
  Router.get('/moderation/tickets', authenticate(), isModMiddleware(), route);
}

async function route(req: Request, res: Response) {
  let status: undefined | TicketStatus;

  if (typeof req.query.status === 'string') {
    status = parseInt(req.query.status) as TicketStatus;
  }

  const includeIgnored = req.query.includeIgnored === 'true';

  const after = req.query.after ? parseInt(req.query.after as string) : undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(!includeIgnored ? { ignoredByUsers: { none: { userId: req.userCache.id } } } : {}),
      ...(status !== undefined ? { status } : undefined),
    },
    orderBy: {
      lastUpdatedAt: 'desc',
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    select: {
      id: true,
      status: true,
      category: true,
      title: true,
      openedAt: true,
      ignoredByUsers: { where: { userId: req.userCache.id }, select: { id: true } },
      channelId: true,
      lastUpdatedAt: true,
      openedBy: true,
    },
  });

  res.json(tickets);
}
