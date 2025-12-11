import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { suspendUsersBatch } from '../../services/Moderation';
import { isModMiddleware } from './isModMiddleware';
import { checkUserPassword } from '../../services/UserAuthentication';

export function userBatchSuspend(Router: Router) {
  Router.post('/moderation/users/suspend', authenticate(), isModMiddleware(), body('userIds').not().isEmpty().withMessage('userIds is required').isArray().withMessage('userIds must be an array.'), body('days').not().isEmpty().withMessage('Days are required').isNumeric().withMessage('Days must be a number.').isLength({ min: 0, max: 5 }).withMessage('Days must be less than 99999'), body('reason').not().isEmpty().withMessage('Reason is required.').isString().withMessage('Reason must be a string.').isLength({ min: 0, max: 500 }), body('ipBan').optional(true).isBoolean().withMessage('ipBan must be a boolean.'), body('deleteRecentMessages').optional(true).isBoolean().withMessage('deleteRecentMessages must be a boolean.'), body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').isString().withMessage('Password must be a string!').not().isEmpty().withMessage('Password is required'), route);
}

interface Body {
  userIds: string[];
  days: number;
  reason?: string;
  password: string;
  ipBan?: boolean;
  deleteRecentMessages?: boolean;
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.body.days > 31) {
    return res.status(403).json(generateError('Days must be less than 31', 'days'));
  }

  const account = await prisma.account.findFirst({
    where: { id: req.userCache.account!.id },
    select: { password: true },
  });
  if (!account) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(account.password, req.body.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));

  const [status, error] = await suspendUsersBatch({
    userIds: req.body.userIds,
    days: req.body.days,
    reason: req.body.reason,
    suspendByUserId: req.userCache.id,
    suspendByUsername: req.userCache.username,
    ipBan: req.body.ipBan,
    deleteRecentMessages: req.body.deleteRecentMessages,
  });

  if (error) {
    return res.status(400).json(error);
  }

  return res.status(200).json({ status });
}
