import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { dateToDateTime, prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { authenticate } from '../../middleware/authenticate';
import { disconnectUsers } from '../../services/Moderation';
import { isModMiddleware } from './isModMiddleware';
import { removeAllowedIPsCache } from '../../cache/UserCache';
import { AuditLogType } from '../../common/AuditLog';
import { checkUserPassword } from '../../services/UserAuthentication';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';

export function useEditSuspension(Router: Router) {
  Router.patch('/moderation/users/suspend', authenticate(), isModMiddleware, body('userIds').not().isEmpty().withMessage('userIds is required').isArray().withMessage('userIds must be an array.'), body('days').optional().isNumeric().withMessage('Days must be a number.').isLength({ min: 0, max: 5 }).withMessage('Days must be less than 99999'), body('reason').optional().isString().withMessage('Reason must be a string.').isLength({ min: 0, max: 500 }), body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').isString().withMessage('Password must be a string!').not().isEmpty().withMessage('Password is required'), route);
}

interface Body {
  userIds: string[];
  days: number;
  reason?: string;
  password: string;
}

const DAY_IN_MS = 86400000;
const expireAfter = (days: number) => {
  const now = Date.now();
  const expireDate = new Date(now + DAY_IN_MS * days);
  return expireDate;
};

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.body.days && req.body.days > 31) {
    return res.status(403).json(generateError('Days must be less than 31', 'days'));
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

  const expireDateTime = req.body.days !== undefined ? dateToDateTime(expireAfter(req.body.days)) : '';

  const suspendedUsers = await prisma.suspension.findMany({
    where: { userId: { in: sanitizedUserIds } },
    select: { userId: true, user: { select: { id: true, username: true } } },
  });
  const suspendedUserIds = suspendedUsers.map((suspend) => suspend.userId);

  await prisma.$transaction(
    suspendedUserIds.map((userId) =>
      prisma.suspension.update({
        where: { userId },
        data: {
          ...addToObjectIfExists('reason', req.body.reason),
          ...(req.body.days !== undefined
            ? {
                expireAt: req.body.days ? expireDateTime : null,
              }
            : {}),
        },
      })
    )
  );

  await prisma.firebaseMessagingToken.deleteMany({
    where: { account: { userId: { in: sanitizedUserIds } } },
  });

  await prisma.auditLog.createMany({
    data: suspendedUsers.map((suspend) => ({
      id: generateId(),
      actionType: AuditLogType.userSuspendUpdate,
      actionById: req.userCache.id,
      username: suspend.user.username,
      userId: suspend.user.id,
    })),
  });

  res.status(200).json({ success: true });
}
