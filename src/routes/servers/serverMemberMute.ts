import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { muteServerMember } from '../../services/Server';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '@src/common/errorHandler';

export function serverMemberMute(Router: Router) {
  Router.post(
    '/servers/:serverId/mutes/:userId',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    body('reason').isString().withMessage('Reason must be a string!').isLength({ min: 1, max: 150 }).withMessage('Reason length must be between 1 and 150 characters.').optional({ nullable: true }),
    body('expireMS').notEmpty().withMessage('ExpireMS is required.').isNumeric().withMessage('ExpireMS must be a number!'),

    rateLimit({
      name: 'server_mute_member',
      restrictMS: 10000,
      requests: 30,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }
  const userId = req.params.userId as string;

  const [, error] = await muteServerMember(userId, req.serverCache.id, req.body.expireMS, req.userCache.id, req.body?.reason);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status: true });
}
