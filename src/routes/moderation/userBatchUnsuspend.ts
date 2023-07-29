import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { dateToDateTime, prisma } from '../../common/database';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { authenticate } from '../../middleware/authenticate';
import { disconnectUsers } from '../../services/Moderation';
import { checkUserPassword } from '../../services/User';
import { isModMiddleware } from './isModMiddleware';
import { removeAccountCacheByUserIds } from '../../cache/UserCache';

export function userBatchUnsuspend(Router: Router) {
  Router.delete(
    '/moderation/users/suspend',
    authenticate(),
    isModMiddleware,
    body('userIds')
      .not()
      .isEmpty()
      .withMessage('userIds is required')
      .isArray()
      .withMessage('userIds must be an array.'),
    body('password')
      .isString()
      .withMessage('Password must be a string!')
      .not()
      .isEmpty()
      .withMessage('Password is required'),
    route
  );
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
    where: { id: req.accountCache.id },
    select: { password: true },
  });
  if (!account)
    return res
      .status(404)
      .json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(
    req.body.password,
    account.password!
  );
  if (!isPasswordValid)
    return res.status(403).json(generateError('Invalid password.', 'password'));

  if (req.body.userIds.length >= 5000)
    return res
      .status(403)
      .json(generateError('user ids must contain less than 5000 ids.'));

  const sanitizedUserIds = removeDuplicates(req.body.userIds) as string[];

  await prisma.suspension.deleteMany({
    where: { userId: { in: sanitizedUserIds } },
  });

  await removeAccountCacheByUserIds(sanitizedUserIds);

  res.status(200).json({ success: true });
}
