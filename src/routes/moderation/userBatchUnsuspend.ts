import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { removeUserCacheByUserIds } from '../../cache/UserCache';
import { ModAuditLogType } from '../../common/ModAuditLog';
import { checkUserPassword } from '../../services/UserAuthentication';

export function userBatchUnsuspend(Router: Router) {
  Router.delete('/moderation/users/suspend', authenticate(), isModMiddleware, body('userIds').not().isEmpty().withMessage('userIds is required').isArray().withMessage('userIds must be an array.'), body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').isString().withMessage('Password must be a string!').not().isEmpty().withMessage('Password is required'), route);
}

interface Body {
  userIds: string[];
  password: string;
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const account = await prisma.account.findFirst({
    where: { id: req.userCache.account.id },
    select: { password: true },
  });
  if (!account) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(account.password, req.body.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));

  if (req.body.userIds.length >= 5000) return res.status(403).json(generateError('user ids must contain less than 5000 ids.'));

  const sanitizedUserIds = removeDuplicates(req.body.userIds) as string[];

  const suspensions = await prisma.suspension.findMany({
    where: { userId: { in: sanitizedUserIds } },
    select: { userId: true },
  });
  const suspensionsUserId = suspensions.map((suspension) => suspension.userId);
  await prisma.account.updateMany({
    where: { userId: { in: suspensionsUserId } },
    data: {
      suspendCount: {
        decrement: 1,
      },
    },
  });

  const [, unsuspendUsers] = await prisma.$transaction([
    prisma.suspension.deleteMany({
      where: { userId: { in: sanitizedUserIds } },
    }),
    prisma.user.findMany({
      where: { id: { in: sanitizedUserIds } },
      select: { id: true, username: true },
    }),
  ]);

  await removeUserCacheByUserIds(sanitizedUserIds);

  await prisma.modAuditLog.createMany({
    data: unsuspendUsers.map((user) => ({
      id: generateId(),
      actionType: ModAuditLogType.userUnsuspend,
      actionById: req.userCache.id,
      username: user.username,
      userId: user.id,
    })),
  });

  res.status(200).json({ success: true });
}
