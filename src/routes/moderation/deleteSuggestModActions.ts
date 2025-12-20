import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { prisma } from '@src/common/database';

export function deleteSuggestModActions(Router: Router) {
  Router.delete<any>(
    '/moderation/suggest_action/:actionId',
    authenticate(),
    isModMiddleware({ allowModBadge: true }),

    route
  );
}

async function route(req: Request, res: Response) {
  const actionId = req.params.actionId;

  await prisma.moderatorSuggestAction.delete({
    where: {
      id: actionId,
    },
  });

  return res.status(200).json({ success: true });
}
