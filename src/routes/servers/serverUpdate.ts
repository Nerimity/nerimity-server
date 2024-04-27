import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServer } from '../../services/Server';

export function serverUpdate(Router: Router) {
  Router.post('/servers/:serverId',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    body('name')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 4, max: 35 }).withMessage('Name must be between 4 and 35 characters long.').optional({ nullable: true }),
    body('defaultChannelId')
      .isString().withMessage('defaultChannelId must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('defaultChannelId must be between 4 and 100 characters long.').optional({ nullable: true }),
    body('systemChannelId')
      .isString().withMessage('systemChannelId must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('systemChannelId must be between 4 and 100 characters long.').optional({ nullable: true }),
    rateLimit({
      name: 'server_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  name?: string;
  defaultChannelId?: string;
  avatar?: string;
  banner?: string;
}



async function route(req: Request, res: Response) {

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);

  const [updated, error] = await updateServer(req.serverCache.id, {
    ...matchedBody,
    avatar: req.body.avatar,
    banner: req.body.banner,
    ...(req.body.systemChannelId === null ? { systemChannelId: null } : undefined)
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);

}