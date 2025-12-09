import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { banServerMember } from '../../services/Server';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '@src/common/errorHandler';

export function serverMemberBan(Router: Router) {
  // Router.delete('/servers/:serverId/members/:userId/ban',
  Router.post(
    '/servers/:serverId/bans/:userId',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.BAN),
    body('reason').isString().withMessage('Reason must be a string!').isLength({ min: 1, max: 150 }).withMessage('Reason length must be between 1 and 150 characters.').optional({ nullable: true }),

    rateLimit({
      name: 'server_ban_member',
      restrictMS: 10000,
      requests: 30,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }
  const userId = req.params.userId as string;
  const shouldDeleteRecentMessages = req.query.shouldDeleteRecentMessages === 'true'; // Delete messages sent in the last 7 hours.

  const [, error] = await banServerMember(userId, req.serverCache.id, req.userCache.id, shouldDeleteRecentMessages, req.body?.reason);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status: true });
}
