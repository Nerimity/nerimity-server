import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';

import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { deleteServer } from '../../services/Server';
import { generateId } from '../../common/flakeId';
import { AuditLogType } from '../../common/AuditLog';
import { checkUserPassword } from '../../services/UserAuthentication';

export function serverDelete(Router: Router) {
  Router.delete<any>(
    '/moderation/servers/:serverId',
    authenticate(),
    isModMiddleware,

    body('password')
      .isLength({ min: 4, max: 72 })
      .withMessage('Password must be between 4 and 72 characters long.')
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
    where: { id: req.userCache.account.id },
    select: { password: true },
  });
  if (!account)
    return res
      .status(404)
      .json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(
    account.password,
    req.body.password
  );
  if (!isPasswordValid)
    return res.status(403).json(generateError('Invalid password.', 'password'));

  const server = await prisma.server.findUnique({
    where: { id: req.params.serverId },
  });

  if (!server)
    return res.status(404).json(generateError('Server does not exist.'));

  const [, error] = await deleteServer(req.params.serverId);
  if (error) {
    return res.status(403).json(error);
  }

  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: AuditLogType.serverDelete,
      actionById: req.userCache.id,
      serverName: server.name,
      serverId: server.id,
    },
  });

  res.status(200).json({ success: true });
}
