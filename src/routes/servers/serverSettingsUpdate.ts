import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServer } from '../../services/Server';

export function serverSettingsUpdate(Router: Router) {
  Router.post('/servers/:serverId', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.ADMIN),
    body('name')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.').optional({nullable: true}),
    body('defaultChannelId')
      .isString().withMessage('defaultChannelId must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('defaultChannelId must be between 4 and 100 characters long.').optional({nullable: true}),
    body('systemChannelId')
      .isString().withMessage('systemChannelId must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('systemChannelId must be between 4 and 100 characters long.').optional({nullable: true}),
    rateLimit({
      name: 'server_update',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}

interface Body {
  name?: string;
  defaultChannelId?: string;
}



async function route (req: Request, res: Response) {

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);

  const [updated, error] = await updateServer(req.serverCache.id, {
    ...matchedBody,
    ...(req.body.systemChannelId === null ? {systemChannelId: null} : undefined)
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);    

}