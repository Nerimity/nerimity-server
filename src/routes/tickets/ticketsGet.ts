import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { authenticate } from '../../middleware/authenticate';
import { TicketStatus, getOwnTickets } from '../../services/Ticket';
import { generateError } from '../../common/errorHandler';

export function ticketsGet(Router: Router) {
  Router.get(
    '/tickets',
    authenticate(),
    rateLimit({
      name: 'tickets-get',
      restrictMS: 60000,
      requests: 30,
    }),
    route
  );
}
async function route(req: Request, res: Response) {
  let status: undefined | TicketStatus;

  let seen: undefined | boolean = undefined;

  if (req.query.seen) {
    seen = req.query.seen === 'true';
  }

  if (typeof req.query.status === 'string') {
    status = parseInt(req.query.status) as TicketStatus;
  }

  if (status !== undefined) {
    if (!Object.values(TicketStatus).includes(status)) {
      return res.status(400).json(generateError('Invalid status.'));
    }
  }

  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }
  if (limit < 0) {
    limit = 30;
  }

  const tickets = await getOwnTickets(req.userCache.id, {
    status,
    limit,
    seen,
  });

  res.json(tickets);
}
