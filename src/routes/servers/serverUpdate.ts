import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServer } from '../../services/Server';
import { verifyUpload } from '../../common/nerimityCDN';
import { hasBadWord } from '../../common/badWords';

export function serverUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    body('name').isString().withMessage('Name must be a string.').isLength({ min: 4, max: 35 }).withMessage('Name must be between 4 and 35 characters long.').optional({ nullable: true }),
    body('defaultChannelId').isString().withMessage('defaultChannelId must be a string.').isLength({ min: 4, max: 100 }).withMessage('defaultChannelId must be between 4 and 100 characters long.').optional({ nullable: true }),
    body('systemChannelId').isString().withMessage('systemChannelId must be a string.').isLength({ min: 4, max: 100 }).withMessage('systemChannelId must be between 4 and 100 characters long.').optional({ nullable: true }),
    body('avatarId').isString().withMessage('avatarId must be a string.').isLength({ min: 4, max: 100 }).withMessage('avatarId must be between 4 and 100 characters long.').optional({ nullable: true }),
    body('bannerId').isString().withMessage('bannerId must be a string.').isLength({ min: 4, max: 100 }).withMessage('bannerId must be between 4 and 100 characters long.').optional({ nullable: true }),
    rateLimit({
      name: 'server_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  name?: string;
  defaultChannelId?: string;
  avatarId?: string | null;
  bannerId?: string | null;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const { avatarId, bannerId, ...matchedBody }: Body = matchedData(req);

  if (avatarId || bannerId) {
    if (!req.userCache.account?.emailConfirmed) {
      return res.status(400).json(generateError('You must confirm your email before choosing an avatar or banner.'));
    }
  }

  if (matchedBody.name) {
    const urlRegex = new RegExp('(^|[ \t\r\n])((http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))');
    if (urlRegex.test(matchedBody.name)) {
      return res.status(400).json(generateError('Name cannot be a URL.', 'name'));
    }
    if (hasBadWord(matchedBody.name)) {
      return res.status(400).json(generateError('Name cannot contain bad words.', 'name'));
    }
  }

  let avatar: string | null | undefined;
  let banner: string | null | undefined;

  if (avatarId) {
    const [uploadedFile, err] = await verifyUpload({
      fileId: avatarId,
      type: 'AVATAR',
      groupId: req.serverCache.id,
    });

    if (err) {
      return res.status(403).json(generateError(err));
    }

    avatar = uploadedFile!.path;
  } else if (req.body.avatarId === null) {
    avatar = null;
  }

  if (bannerId) {
    const [uploadedFile, err] = await verifyUpload({
      fileId: bannerId,
      type: 'BANNER',
      groupId: req.serverCache.id,
    });

    if (err) {
      return res.status(403).json(generateError(err));
    }

    banner = uploadedFile!.path;
  } else if (req.body.bannerId === null) {
    banner = null;
  }

  const [updated, error] = await updateServer(
    req.serverCache.id,
    {
      ...matchedBody,
      banner,
      avatar,
      ...(req.body.systemChannelId === null ? { systemChannelId: null } : undefined),
    },
    req.userCache.id
  );
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}
