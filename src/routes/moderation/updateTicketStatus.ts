import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { authenticate } from '../../middleware/authenticate';
import { TicketStatus, updateTicketStatus } from '../../services/Ticket';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { isModMiddleware } from './isModMiddleware';
import { prisma } from '../../common/database';

export function ticketUpdate(Router: Router) {
  Router.post(
    '/moderation/tickets/:id',
    authenticate(),
    isModMiddleware(),

    body('status').isNumeric().withMessage('status must be a number!'),

    rateLimit({
      name: 'ticket-update-mod',
      restrictMS: 60000,
      requests: 60,
    }),
    route
  );
}

interface Body {
  status: TicketStatus;
}

async function route(req: Request, res: Response) {
  const id = parseInt(req.params.id as string);
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [ticket, error] = await updateTicketStatus({
    ticketId: id,
    status: body.status,
  });

  if (ticket) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { seen: false },
    });
  }

  if (error) {
    return res.status(400).json(generateError(error));
  }

  res.json(ticket);
}
