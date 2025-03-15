import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { checkUserPassword } from '../../services/UserAuthentication';
import { shadowBanUsersBatch, undoShadowBanUsersBatch, warnUsersBatch } from '../../services/Moderation';

export enum NoticeType {
  Warning = 0,
}

export function userBatchUndoShadowBan(Router: Router) {
  Router.delete('/moderation/users/shadow-ban', authenticate(), isModMiddleware, body('userIds').not().isEmpty().withMessage('userIds is required').isArray().withMessage('userIds must be an array.'), body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').isString().withMessage('Password must be a string!').not().isEmpty().withMessage('Password is required'), route);
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
    where: { id: req.userCache.account!.id },
    select: { password: true },
  });
  if (!account) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(account.password, req.body.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));

  const [status, error] = await undoShadowBanUsersBatch({
    userIds: req.body.userIds,
    modUserId: req.userCache.id,
    modUsername: req.userCache.username,
  });

  if (error) {
    return res.status(403).json(error);
  }

  return res.status(200).json({ status });
}
