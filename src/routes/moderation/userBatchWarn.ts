import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { dateToDateTime, prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { ModAuditLogType } from '../../common/ModAuditLog';
import { checkUserPassword } from '../../services/UserAuthentication';
import { emitUserNoticeCreates } from '../../emits/User';

export enum NoticeType {
  Warning = 0,
}

export function userBatchWarn(Router: Router) {
  Router.post('/moderation/users/warn', authenticate(), isModMiddleware, body('userIds').not().isEmpty().withMessage('userIds is required').isArray().withMessage('userIds must be an array.'), body('reason').not().isEmpty().withMessage('Reason is required.').isString().withMessage('Reason must be a string.').isLength({ min: 0, max: 500 }), body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').isString().withMessage('Password must be a string!').not().isEmpty().withMessage('Password is required'), route);
}

interface Body {
  userIds: string[];
  reason: string;
  password: string;
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const account = await prisma.account.findFirst({
    where: { id: req.userCache.account!.id },
    select: { password: true },
  });
  if (!account) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(account.password, req.body.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));

  if (req.body.userIds.length >= 5000) return res.status(403).json(generateError('user ids must contain less than 5000 ids.'));

  const sanitizedUserIds = removeDuplicates(req.body.userIds) as string[];

  const sixMonthsMS = new Date().setMonth(new Date().getMonth() + 6);

  await prisma.account.updateMany({
    where: {
      warnExpiresAt: {
        lt: dateToDateTime(),
      },
    },
    data: {
      warnCount: 0,
      warnExpiresAt: null,
    },
  });

  await prisma.account.updateMany({
    where: {
      userId: { in: sanitizedUserIds },
    },
    data: {
      warnCount: { increment: 1 },
      warnExpiresAt: dateToDateTime(sixMonthsMS),
    },
  });

  const noticeIds: string[] = [];

  await prisma.userNotice.createMany({
    data: sanitizedUserIds.map((userId) => {
      const id = generateId();
      noticeIds.push(id);

      return {
        id,
        userId,
        content: req.body.reason,
        type: NoticeType.Warning,
        createdById: req.userCache.id,
      };
    }),
  });

  const createdNotices = await prisma.userNotice.findMany({
    where: { id: { in: noticeIds } },
    select: { userId: true, id: true, type: true, title: true, content: true, createdAt: true, createdBy: { select: { username: true } } },
  });

  emitUserNoticeCreates(createdNotices);

  const warnedUsers = await prisma.user.findMany({
    where: { id: { in: sanitizedUserIds } },
    select: { id: true, username: true },
  });

  await prisma.modAuditLog.createMany({
    data: warnedUsers.map((user) => ({
      id: generateId(),
      actionType: ModAuditLogType.userWarned,
      actionById: req.userCache.id,
      username: user.username,
      userId: user.id,
      reason: req.body.reason,
    })),
  });

  res.status(200).json({ success: true });
}
