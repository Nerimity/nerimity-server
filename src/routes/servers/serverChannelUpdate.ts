import { Request, Response, Router } from 'express';
import { body, matchedData } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { updateServerChannel } from '../../services/Channel';

export function serverChannelUpdate(Router: Router) {
  Router.post(
    '/servers/:serverId/channels/:channelId',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    body('name').isString().withMessage('Name must be a string.').isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters long.').not().contains('#').withMessage('Channel cannot contain the # symbol').optional({ nullable: true }),

    body('slowModeSeconds')
      .isNumeric()
      .withMessage('slowModeSeconds must be a number.')
      .isInt({ min: 0, max: 21600 })
      .withMessage('slowModeSeconds must be between 0 and 21600.')
      .custom((value) => {
        if (!value) return true;
        return value > 2;
      })
      .withMessage('slowModeSeconds must be at least 3 seconds or 0.')
      .optional({ nullable: true }),
    body('icon').isString().withMessage('Icon must be a string.').isLength({ min: 0, max: 100 }).withMessage('Icon must be between 0 and 100 characters long.').optional({ nullable: true }),
    rateLimit({
      name: 'server_channel_update',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  name?: string;
  icon?: string | null;
  slowModeSeconds?: number | null;
}

async function route(req: Request, res: Response) {
  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const matchedBody: Body = matchedData(req);

  if (req.body.icon === null) {
    matchedBody.icon = null;
  }

  if (req.body.slowModeSeconds === 0 || req.body.slowModeSeconds === null) {
    matchedBody.slowModeSeconds = null;
  }

  const [updated, error] = await updateServerChannel(req.serverCache.id, req.params.channelId!, matchedBody, req.userCache.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(updated);
}
