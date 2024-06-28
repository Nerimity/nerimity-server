import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerMemberProfile } from '../../services/ServerMember';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';

export function serverMemberProfileUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/members/:userId/profile',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.NICKNAME_MEMBER),
    body('nickname').isString().withMessage('Invalid username.').isLength({ min: 3, max: 35 }).withMessage('Nickname must be between 3 and 35 characters long.').optional({ nullable: true }),
    rateLimit({
      name: 'server_member_profile_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  nickname?: string | null;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const body = req.body as Body;

  const [updated, error] = await updateServerMemberProfile(req.serverCache.id, req.params.userId, req.userCache.id, {
    ...(body.nickname !== undefined ? { nickname: body.nickname?.trim() || null } : {}),
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}
