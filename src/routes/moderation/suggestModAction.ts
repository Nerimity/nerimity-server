import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { ModAuditLogType } from '@src/common/ModAuditLog';
import { prisma } from '@src/common/database';
import { generateId } from '@src/common/flakeId';

export function suggestModAction(Router: Router) {
  Router.post<any>(
    '/moderation/suggest_action',
    authenticate(),
    isModMiddleware({ allowModBadge: true }),
    body('reason').isString().withMessage('Reason must be a string.').notEmpty().withMessage('Reason is required.').isLength({ min: 1, max: 500 }).withMessage('Reason must be 1-500 chars.'),

    body('actionType').isInt().withMessage('Action Type must be a number.').notEmpty().withMessage('Action Type is required.'),

    body('serverId').optional().isString().withMessage('Server ID must be a string.'),

    body('postId').optional().isString().withMessage('Post ID must be a string.'),

    body('userId').optional().isString().withMessage('User ID must be  a string.'),

    route
  );
}

interface Body {
  actionType: (typeof ModAuditLogType)[keyof typeof ModAuditLogType];

  serverId?: string;
  postId?: string;
  userId?: string;

  reason: string;
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const existing = await prisma.moderatorSuggestAction.findUnique({
    where: {
      userId: req.userCache.id,
      serverId: req.body.serverId,
      postId: req.body.postId,
    },
  });

  if (existing) {
    const reason = existing.reason + '\n\n' + req.body.reason;

    await prisma.moderatorSuggestAction.update({
      where: {
        id: existing.id,
      },
      data: {
        reason,
      },
    });

    return res.status(200).json({ success: true, data: { ...existing, reason } });
  }

  const data = await prisma.moderatorSuggestAction.create({
    data: {
      id: generateId(),
      userId: req.userCache.id,
      serverId: req.body.serverId,
      postId: req.body.postId,
      suggestById: req.userCache.id,
      actionType: req.body.actionType as number,
      reason: req.body.reason,
    },
  });

  res.status(200).json({ success: true, data });
}
