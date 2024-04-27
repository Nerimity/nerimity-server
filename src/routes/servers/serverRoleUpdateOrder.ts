import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { prisma } from '../../common/database';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import {
  updateServerRole,
  updateServerRoleOrder,
} from '../../services/ServerRole';

export function serverRoleUpdateOrder(Router: Router) {
  Router.post(
    '/servers/:serverId/roles/order',
    authenticate({allowBot: true}),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_ROLES),
    body('roleIds').isArray().withMessage('roleIds must be an array.'),
    rateLimit({
      name: 'server_role_update_order',
      restrictMS: 10000,
      requests: 50,
    }),
    route
  );
}

interface Body {
  roleIds: string[];
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const isServerOwner = req.serverCache.createdById === req.userCache.id;

  const topRoleOrder = isServerOwner
    ? body.roleIds.length + 1
    : req.serverMemberCache.topRoleOrder;

  const [updated, error] = await updateServerRoleOrder(
    topRoleOrder,
    req.serverCache.id,
    body.roleIds
  );
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}
