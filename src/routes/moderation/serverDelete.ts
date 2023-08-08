import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';

import { authenticate } from '../../middleware/authenticate';
import { checkUserPassword } from '../../services/User';
import { isModMiddleware } from './isModMiddleware';
import { deleteServer } from '../../services/Server';

export function userBatchSuspend(Router: Router) {
  Router.delete<any>(
    '/moderation/servers/:serverId',
    authenticate(),
    isModMiddleware,

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
  password: string;
}

interface Params {
  serverId: string;
}

async function route(req: Request<Params, unknown, Body>, res: Response) {
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

  const [error] = await deleteServer(req.params.serverId);
  if (error) {
    res.status(403).json(error);
  }

  res.status(200).json({ success: true });
}
