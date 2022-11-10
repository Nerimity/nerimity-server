import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { authenticate } from '../../middleware/authenticate';
import { checkUserPassword } from '../../services/User';
import { isModMiddleware } from './isModMiddleware';

export function userBatchSuspend(Router: Router) {
  Router.post('/moderation/users/suspend', 
    authenticate(),
    isModMiddleware,
    body('userIds')
      .not().isEmpty().withMessage('userIds is required')
      .isArray().withMessage('userIds must be an array.'),
    body('password')
      .not().isEmpty().withMessage('Password is required'),
    body('days')
      .not().isEmpty().withMessage('Days are required')
      .isNumeric().withMessage('Days must be a number.')
      .isLength({ min: 0, max: 5 }).withMessage('Days must be less than 99999'),
    body('reason')
      .optional()
      .isString().withMessage('Reason must be a string.')
      .isLength({ min: 0, max: 500 }).withMessage('Reason must be less than 500 characters long.'),
    route
  );
}

interface Body {
  userIds: string[];
  days: number;
  reason: string;
  password: string;
}

async function route (req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const account = await prisma.account.findFirst({where: { id: req.accountCache.id }, select: {password: true}});
  if (!account) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(req.body.password, account.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));

  if (req.body.userIds.length >= 5000) return res.status(403).json(generateError('userIds must contain less than 5000 ids.'));

  const sanitizedUserIds = removeDuplicates(req.body.userIds) as string[];

  const DAY_IN_MS = 86400000;
  const now = Date.now();
  const expireDate = new Date(now + (DAY_IN_MS * req.body.days));
  

  prisma.$transaction(sanitizedUserIds.map(userId => (
    prisma.account.update({where: {userId}, data: {suspendCount: {increment: 1}}})
  )));


  prisma.suspension.createMany({
    data: sanitizedUserIds.map(userId => ({
      id: generateId(),
      userId,
      reason: req.body.reason,
      expireAt: expireDate.toISOString(),
      suspendedById: req.accountCache.user.id
    }))
  });



}