import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { authenticate } from '../../middleware/authenticate';
import { TicketCategory, createTicket } from '../../services/Ticket';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';

export function ticketsCreate(Router: Router) {
  Router.post(
    '/tickets',
    authenticate(),

    body('body')
      .isString()
      .withMessage('Body must be a string!')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Body length must be between 1 and 2000 characters.'),

    body('title')
      .isString()
      .withMessage('Title must be a string!')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title length must be between 1 and 200 characters.'),

    body('category').isInt().withMessage('Category must be a number!'),

    rateLimit({
      name: 'tickets-create',
      expireMS: 60000,
      requestCount: 3,
    }),
    route
  );
}

interface Body {
  category: TicketCategory;
  title: string;
  body: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [ticket, error] = await createTicket({
    title: body.title,
    category: body.category,
    body: body.body,
    requestedById: req.userCache.id,
  });

  if (error) {
    return res.status(400).json(generateError(error));
  }

  res.json(ticket);
}
