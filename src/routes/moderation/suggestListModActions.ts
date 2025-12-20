import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { prisma } from '@src/common/database';

export function listSuggestModActions(Router: Router) {
  Router.get<any>(
    '/moderation/suggest_action',
    authenticate(),
    isModMiddleware({ allowModBadge: true }),

    route
  );
}

async function route(req: Request, res: Response) {
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const data = await prisma.moderatorSuggestAction.findMany({
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    include: {
      suggestBy: {
        select: {
          id: true,
          username: true,
          tag: true,
          avatar: true,
          hexColor: true,
          badges: true,
        },
      },
      server: {
        select: {
          publicServer: { select: { id: true, pinnedAt: true } },
          scheduledForDeletion: true,
          name: true,
          hexColor: true,
          id: true,
          createdAt: true,
          createdBy: {
            select: { id: true, username: true, tag: true, badges: true },
          },
          avatar: true,
        },
      },
    },
  });

  res.status(200).json({ success: true, data });
}
