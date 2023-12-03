import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { authenticate } from '../../middleware/authenticate';
import { TicketStatus, updateTicketStatus } from '../../services/Ticket';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';

export function ticketUpdate(Router: Router) {
  Router.post(
    '/tickets/:id',
    authenticate(),

    body('status').isNumeric().withMessage('status must be a number!'),

    rateLimit({
      name: 'ticket-update',
      expireMS: 60000,
      requestCount: 30,
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

  if (body.status !== TicketStatus.WAITING_FOR_MODERATOR_RESPONSE) {
    return res.status(400).json(generateError('Invalid status.'));
  }

  const [ticket, error] = await updateTicketStatus({
    ticketId: id,
    status: body.status,
    userId: req.accountCache.user.id,
  });

  if (error) {
    return res.status(400).json(generateError(error));
  }

  res.json(ticket);
}
