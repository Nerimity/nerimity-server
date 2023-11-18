import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { authenticate } from '../../middleware/authenticate';
import { getOwnTickets } from '../../services/Ticket';

export function ticketsGet(Router: Router) {
  Router.get(
    '/tickets',
    authenticate(),
    rateLimit({
      name: 'tickets-get',
      expireMS: 60000,
      requestCount: 30,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const tickets = await getOwnTickets(req.accountCache.user.id);

  res.json(tickets);
}
