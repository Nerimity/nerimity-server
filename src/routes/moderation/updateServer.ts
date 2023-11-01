import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import { emitServerUpdated } from '../../emits/Server';
import { generateId } from '../../common/flakeId';
import { AuditLogType } from '../../common/AuditLog';
import { checkUserPassword } from '../../services/UserAuthentication';

export function updateServer(Router: Router) {
  Router.post(
    '/moderation/servers/:serverId',
    authenticate(),
    isModMiddleware,
    body('name')
      .isString()
      .withMessage('Password must be a string!')
      .optional(),
    body('verified')
      .isBoolean()
      .withMessage('Verified must be a boolean!')
      .optional(),
    body('password')
      .isString()
      .withMessage('Password must be a string!')
      .not()
      .isEmpty()
      .withMessage('Password is required'),
    route
  );
}

async function route(req: Request, res: Response) {
  const serverId = req.params.serverId;

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
    account.password,
    req.body.password
  );
  if (!isPasswordValid)
    return res.status(403).json(generateError('Invalid password.', 'password'));

  const update = {
    ...addToObjectIfExists('name', req.body.name),
    ...addToObjectIfExists('verified', req.body.verified),
  };

  const server = await prisma.server.update({
    where: { id: serverId },
    data: update,
    select: {
      name: true,
      verified: true,
      hexColor: true,
      id: true,
      createdAt: true,
      createdBy: { select: { id: true, username: true, tag: true } },
      avatar: true,
    },
  });

  emitServerUpdated(serverId, update);

  await prisma.auditLog.create({
    data: {
      id: generateId(),
      actionType: AuditLogType.serverUpdate,
      actionById: req.accountCache.user.id,
      serverName: server.name,
      serverId: server.id,
    },
  });

  res.json(server);
}
