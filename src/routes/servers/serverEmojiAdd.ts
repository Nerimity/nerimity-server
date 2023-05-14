import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { addServerAvatar } from '../../services/Server';

export function serverEmojiAdd(Router: Router) {
  Router.post('/servers/:serverId/emojis', 
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.ADMIN),
    body('name')
      .not().isEmpty().withMessage('Name is required')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 2, max: 10 }).withMessage('Name must be between 2 and 10 characters long.'),
    body('emoji')
      .not().isEmpty().withMessage('Emoji is required')
      .isString().withMessage('Emoji must be a string.'),
    rateLimit({
      name: 'server_add_emojis',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}

interface Body {
  name: string;
  emoji: string;
}

async function route (req: Request, res: Response) {

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const body: Body = req.body;

  const [updated, error] = await addServerAvatar({
    name: body.name,
    base64: body.emoji,
    serverId: req.serverCache.id,
    uploadedById: req.accountCache.user.id
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);    

}