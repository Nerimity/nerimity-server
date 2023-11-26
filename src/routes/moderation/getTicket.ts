import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
export function getTicket(Router: Router) {
  Router.get('/moderation/tickets/:id', authenticate(), isModMiddleware, route);
}

async function route(req: Request, res: Response) {
  const id = parseInt(req.params.id as string);

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      category: true,
      title: true,
      openedAt: true,
      channelId: true,
      lastUpdatedAt: true,
      openedBy: true,
    },
  });

  res.json(ticket);
}
