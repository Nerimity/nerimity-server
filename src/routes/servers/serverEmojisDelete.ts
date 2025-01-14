import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { deleteServerEmoji, getServerEmojis } from '../../services/Server';

export function serverEmojiDelete(Router: Router) {
  Router.delete('/servers/:serverId/emojis/:id',
    authenticate({allowBot: true}),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'server_delete_emojis',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}



async function route(req: Request, res: Response) {

  const [, error] = await deleteServerEmoji(req.serverCache.id, req.params.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.status(200).end();
}