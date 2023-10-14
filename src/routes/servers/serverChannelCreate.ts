import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { createServerChannel } from '../../services/Channel';
import { ChannelType } from '../../types/Channel';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function serverChannelCreate(Router: Router) {
  Router.post(
    '/servers/:serverId/channels',
    body('name')
      .isString()
      .withMessage('Name must be a string.')
      .trim()
      .isLength({ min: 4, max: 100 })
      .withMessage('Name must be between 4 and 100 characters long.')
      .not()
      .contains('#')
      .withMessage('Channel cannot contain the # symbol')
      .optional(),
    body('type')
      .isNumeric()
      .withMessage('type must be a number.')
      .isInt({ gt: 0, lt: 3 })
      .withMessage('type must be ')
      .optional(),
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    route
  );
}

interface Body {
  name: string;
  type?: ChannelType;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const type = body.type || ChannelType.SERVER_TEXT;

  let channelName = 'New Channel';
  if (type === ChannelType.CATEGORY) channelName = 'New Category';

  const [newChannel, error] = await createServerChannel({
    channelName: body.name?.trim() || channelName,
    creatorId: req.accountCache.user.id,
    serverId: req.serverCache.id,
    channelType: body.type,
  });
  // const [newChannel, error] = await createServerChannel(req.serverCache.id, 'New Channel', req.accountCache.user.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(newChannel);
}
