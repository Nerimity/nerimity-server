import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { authenticate } from '../../middleware/authenticate';
import { generateError } from '../../common/errorHandler';
import { isModMiddleware } from './isModMiddleware';
import { prisma } from '../../common/database';
import { generateId } from '@src/common/flakeId';

export function ticketMute(Router: Router) {
  Router.post(
    '/moderation/tickets/:id/mute',
    authenticate(),
    isModMiddleware(),

    rateLimit({
      name: 'ticket-mute-mod',
      restrictMS: 60000,
      requests: 60,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const id = parseInt(req.params.id as string);

  const result = await prisma.ignoredTicket
    .create({
      data: {
        userId: req.userCache.id,
        ticketId: id,
        id: generateId(),
      },
    })
    .catch(() => {
      return false;
    });
  if (!result) {
    return res.status(400).json(generateError('You have already ignored this ticket!'));
  }
  return res.json({ success: true });
}
