import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { hasBit, ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerRole } from '../../services/ServerRole';

export function serverRoleUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/roles/:roleId',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_ROLES),
    body('name').isString().withMessage('Name must be a string.').isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.').optional({ nullable: true }),
    body('hexColor').isString().withMessage('hexColor must be a string.').isLength({ min: 4, max: 100 }).withMessage('hexColor must be between 4 and 100 characters long.').optional({ nullable: true }),
    body('hideRole').isBoolean().withMessage('hideRole must be a boolean.').optional({ nullable: true }),
    body('applyOnJoin').isBoolean().withMessage('applyOnJoin must be a boolean.').optional({ nullable: true }),
    body('permissions').isNumeric().withMessage('Permissions must be a number.').isInt({ min: 0, max: 900 }).withMessage('Permissions must be between 0 and 900.').isLength({ min: 0, max: 100 }).withMessage('Permissions must be between 0 and 100 characters long.').optional({ nullable: true }),
    body('font').isNumeric().withMessage('Font must be a number.').isInt({ min: 0, max: 10 }).withMessage('Font must be between 0 and 10.').optional({ nullable: true }),

    body('icon').isString().withMessage('Icon must be a string.').isLength({ min: 0, max: 100 }).withMessage('Icon must be between 0 and 100 characters long.').optional({ nullable: true }),

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
  hexColor?: string | null;
  hideRoles?: boolean;
  icon?: string | null;
  applyOnJoin?: boolean;
  font?: number | null;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);

  const role = await prisma.serverRole.findUnique({
    where: { id: req.params.roleId },
  });
  if (!role) {
    return res.status(400).json(generateError('Role does not exist.'));
  }
  const isCreator = req.serverCache.createdById === req.userCache.id;
  if (!isCreator && role.order >= req.serverMemberCache.topRoleOrder) {
    return res.status(400).json(generateError('You do not have priority to modify this role.'));
  }

  if (req.body.icon === null) {
    matchedBody.icon = null;
  }

  if (req.body.hexColor === null) {
    matchedBody.hexColor = null;
  }

  if (req.body.font === null) {
    matchedBody.font = null;
  }

  if (!isCreator && matchedBody.permissions !== undefined) {
    const diff = matchedBody.permissions ^ role.permissions;
    if (!hasBit(req.serverMemberCache.permissions, diff)) {
      return res.status(400).json(generateError('You must have this permission to modify this role.'));
    }
    const [highestOrderPerms, highestOrderPermsError] = await getHighestPermission(req.userCache.id, req.serverCache.id);

    if (highestOrderPermsError) {
      return res.status(400).json(highestOrderPermsError);
    }

    for (const key in ROLE_PERMISSIONS) {
      const permission = ROLE_PERMISSIONS[key as keyof typeof ROLE_PERMISSIONS];
      if (!hasBit(diff, permission.bit)) continue;
      const highestOrder = highestOrderPerms.get(permission.bit);
      if (highestOrder === undefined) continue;
      if (role.order >= highestOrder) {
        return res.status(400).json(generateError(`You cannot modify this permission for this role.`));
      }
    }
  }

  const [updated, error] = await updateServerRole(req.serverCache.id, role.id, matchedBody, req.userCache.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}

async function getHighestPermission(userId: string, serverId: string) {
  const [member, roles] = await prisma.$transaction([
    prisma.serverMember.findUnique({
      include: {
        server: {
          select: {
            defaultRoleId: true,
          },
        },
      },
      where: { userId_serverId: { userId, serverId } },
    }),
    prisma.serverRole.findMany({
      where: { serverId },
      select: { permissions: true, order: true, id: true },
      orderBy: { order: 'desc' },
    }),
  ]);
  if (!member) return [null, generateError('Member not found.')] as const;

  const roleIds = [...member.roleIds, member.server.defaultRoleId];

  // permissions[bit] = order
  const permissions = new Map<number, number>();

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i]!;
    if (!roleIds.includes(role.id)) continue;

    for (const key in ROLE_PERMISSIONS) {
      const permission = ROLE_PERMISSIONS[key as keyof typeof ROLE_PERMISSIONS];
      if (permissions.get(permission.bit) !== undefined) continue;
      const hasPerm = hasBit(role.permissions, permission.bit);
      if (hasPerm) {
        permissions.set(permission.bit, role.order);
      }
    }
  }
  return [permissions, null] as const;
}
