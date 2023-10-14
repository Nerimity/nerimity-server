import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerMember } from '../../services/ServerMember';

export function serverMemberUpdate(Router: Router) {
  Router.post('/servers/:serverId/members/:userId',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_ROLES),
    body('roleIds').isArray().withMessage('roleIds must be an array of strings.').optional({ nullable: true }),
    body('roleIds.*')
      .isString().withMessage('roleIds must be a string.')
      .optional({}),
    rateLimit({
      name: 'server_member_role_update',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}

interface Body {
  roleIds?: string[];
}



async function route(req: Request, res: Response) {

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);



  const [updated, error] = await updateServerMember(req.serverCache.id, req.params.userId, req.accountCache.user.id, matchedBody);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);

}