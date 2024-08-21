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
import { updateServerRole } from '../../services/ServerRole';

export function serverRoleUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/roles/:roleId',
    authenticate({allowBot: true}),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_ROLES),
    body('name')
      .isString()
      .withMessage('Name must be a string.')
      .isLength({ min: 4, max: 100 })
      .withMessage('Name must be between 4 and 100 characters long.')
      .optional({ nullable: true }),
    body('hexColor')
      .isString()
      .withMessage('hexColor must be a string.')
      .isLength({ min: 4, max: 100 })
      .withMessage('Name must be between 4 and 100 characters long.')
      .optional({ nullable: true }),
    body('hideRole')
      .isBoolean()
      .withMessage('hideRole must be a boolean.')
      .optional({ nullable: true }),
    body('permissions')
      .isNumeric()
      .withMessage('Permissions must be a number.')
      .isInt({ min: 0, max: 900 })
      .withMessage('Permissions must be between 0 and 900.')
      .isLength({ min: 0, max: 100 })
      .withMessage('Permissions must be between 0 and 100 characters long.')
      .optional({ nullable: true }),

    body('icon')
      .isString()
      .withMessage('Icon must be a string.')
      .isLength({ min: 0, max: 100 })
      .withMessage('Icon must be between 0 and 100 characters long.')
      .optional({ nullable: true }),

    rateLimit({
      name: 'server_role_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  name?: string;
  permissions?: number;
  hexColor?: string;
  hideRoles?: boolean;
  icon?: string | null;

}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);

  const role = await prisma.serverRole.findFirst({
    where: { id: req.params.roleId },
  });
  if (!role) {
    return res.status(400).json(generateError('Role does not exist.'));
  }
  const isCreator = req.serverCache.createdById === req.userCache.id;
  if (!isCreator && role.order >= req.serverMemberCache.topRoleOrder) {
    return res
      .status(400)
      .json(generateError('You do not have priority to modify this role.'));
  }

  if (req.body.icon === null) {
    matchedBody.icon = null;
  }

  const [updated, error] = await updateServerRole(
    req.serverCache.id,
    req.params.roleId,
    matchedBody
  );
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}
