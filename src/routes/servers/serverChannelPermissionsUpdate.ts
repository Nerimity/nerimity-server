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
    '/servers/:serverId/channels/:channelId/permissions/:roleId',
    authenticate({ allowBot: true }),
    channelVerification({ allowBot: true }),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS),

    body('permissions').not().isEmpty().withMessage('Name is required.').isNumeric().withMessage('Permissions must be a number.').isInt({ min: 0, max: 900 }).withMessage('Permissions must be between 0 and 900.').isLength({ min: 0, max: 100 }).withMessage('Permissions must be between 0 and 100 characters long.'),

    rateLimit({
      name: 'server_channel_perm_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  permissions: number;
}
type Params = {
  channelId: string;
  roleId: string;
};

async function route(req: Request<Params, unknown, Body>, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const [updated, error] = await updateServerChannelPermissions({
    channelId: req.channelCache.id,
    roleId: req.params.roleId,
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
