import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { addServerEmoji } from '../../services/Server';
import { verifyUpload } from '../../common/nerimityCDN';

export function serverEmojiAdd(Router: Router) {
  Router.post(
    '/servers/:serverId/emojis',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    body('name')
      .not()
      .isEmpty()
      .withMessage('Name is required')
      .isString()
      .withMessage('Name must be a string.')
      .isLength({ min: 2, max: 15 })
      .withMessage('Name must be between 2 and 15 characters long.'),
    body('fileId')
      .not()
      .isEmpty()
      .withMessage('fileId is required')
      .isString()
      .withMessage('fileId must be a string.')
      .isLength({ min: 2, max: 255 })
      .withMessage('fileId must be between 2 and 255 characters long.'),
    rateLimit({
      name: 'server_add_emojis',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  name: string;
  emoji: string;
  fileId: string;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const body: Body = req.body;

  const [uploadedFile, err] = await verifyUpload({
    fileId: body.fileId,
    type: 'EMOJI',
  });

  if (err) {
    return res.status(403).json(generateError(err));
  }

  const [updated, error] = await addServerEmoji({
    name: body.name,
    emojiPath: uploadedFile!.path,
    emojiId: uploadedFile!.fileId!,
    animated: uploadedFile!.animated,
    serverId: req.serverCache.id,
    uploadedById: req.userCache.id,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}
