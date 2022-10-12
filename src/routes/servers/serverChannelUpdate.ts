import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Permissions';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerChannel } from '../../services/Channel';

export function serverChannelUpdate(Router: Router) {
  Router.post('/servers/:serverId/channels/:channelId', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    body('name')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.').optional({nullable: true}),
    body('permissions')
      .isNumeric().withMessage('Permissions must be a number.')
      .isLength({ min: 0, max: 100 }).withMessage('Permissions must be between 0 and 100 characters long.').optional({nullable: true }),
    rateLimit({
      name: 'server_channel_update',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}

interface Body {
  name?: string;
  permissions?: number;
}



async function route (req: Request, res: Response) {


  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);



  const [updated, error] = await updateServerChannel(req.serverCache.id, req.params.channelId, matchedBody);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);    

}