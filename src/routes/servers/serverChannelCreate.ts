import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { createServerChannel } from '../../services/Channel';
import { ChannelType } from '../../types/Channel';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function serverChannelCreate(Router: Router) {
  Router.post('/servers/:serverId/channels', 
    body('name')
      .isString().withMessage('Name must be a string.')
      .trim()
      .isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.')
      .optional(),
    body('type')
      .isNumeric().withMessage('type must be a number.')
      .isLength({ min: 1, max: 2 }).withMessage('type can be either 1 or 2.')
      .optional(),
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.MANAGE_CHANNELS),
    route
  );
}

interface Body {
  name: string;
  type?: ChannelType;
}


async function route (req: Request, res: Response) {
  const body =  req.body as Body;

  const bodyErrors = customExpressValidatorResult(req);
  if (bodyErrors) {
    return res.status(400).json(bodyErrors);
  }

  const type = body.type ||  ChannelType.SERVER_TEXT;

  const [newChannel, error] = await createServerChannel({
    channelName: body.name?.trim() || (type === ChannelType.CATEGORY ? 'New Category' : 'New Channel'),
    creatorId: req.accountCache.user.id,
    serverId: req.serverCache.id,
    channelType: body.type
  });
  // const [newChannel, error] = await createServerChannel(req.serverCache.id, 'New Channel', req.accountCache.user.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(newChannel);
}