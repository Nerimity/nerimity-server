import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerChannelPermissions } from '../../services/Channel';
import { channelVerification } from '../../middleware/channelVerification';

export function serverChannelPermissionUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/channels/:channelId/permissions',
    authenticate({ allowBot: true }),
    channelVerification({ allowBot: true }),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS),

    body('permissions').not().isEmpty().withMessage('Permissions are required.').isNumeric().withMessage('Permissions must be a number.').isInt({ min: 0, max: 900 }).withMessage('Permissions must be between 0 and 900.'),

    body('roleId').optional().isString().withMessage('Role ID must be a string.').isLength({ min: 1, max: 100 }).withMessage('Role ID must be between 1 and 100 characters long.'),

    body('memberId').optional().isString().withMessage('Member ID must be a string.').isLength({ min: 1, max: 100 }).withMessage('Member ID must be between 1 and 100 characters long.'),

    rateLimit({
      name: 'server_channel_perm_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route,
  );
}

interface Body {
  permissions: number;
  roleId?: string;
  memberId?: string;
}
type Params = {
  channelId: string;
};

async function route(req: Request<Params, unknown, Body>, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [updated, error] = await updateServerChannelPermissions({
    channelId: req.channelCache.id,
    roleId: req.body.roleId,
    memberId: req.body.memberId,
    serverId: req.serverCache.id,
    permissions: req.body.permissions,
  }).catch((err) => {
    console.error(err);
    return [null, generateError('Something went wrong. Try again later.')];
  });

  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}
