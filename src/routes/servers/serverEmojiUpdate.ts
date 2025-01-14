import { Request, Response, Router } from 'express';
import { body, param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { addServerEmoji, updateServerEmoji } from '../../services/Server';

export function serverEmojiUpdate(Router: Router) {
  Router.post('/servers/:serverId/emojis/:id',
    authenticate({allowBot: true}),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    body('name')
      .not().isEmpty().withMessage('Name is required')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 2, max: 15 }).withMessage('Name must be between 2 and 15 characters long.'),
    rateLimit({
      name: 'server_update_emojis',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  name: string;
}

async function route(req: Request, res: Response) {

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const body: Body = req.body;

  const [updated, error] = await updateServerEmoji(req.serverCache.id, req.params.id, body.name);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);

}