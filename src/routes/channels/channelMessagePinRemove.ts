import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { unpinMessage } from '../../services/Message/Message';
import { ChannelType } from '../../types/Channel';
import { rateLimit } from '@src/middleware/rateLimit';

export function channelMessagePinRemove(Router: Router) {
  Router.delete(
    '/channels/:channelId/messages/pins/:messageId',
    authenticate({ allowBot: false }),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS, {
      continueOnError: true,
    }),
    rateLimit({
      name: 'pin_remove',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const params = req.params;

  const isServerChannel = req.channelCache.type === ChannelType.SERVER_TEXT;
  if (isServerChannel) {
    if (req.errorMessage) return res.status(403).json(generateError(req.errorMessage));
  }

  const [isUnpinned, error] = await unpinMessage({
    channelId: req.channelCache.id,
    messageId: params.messageId!,
  });
  if (error) return res.status(500).json(error);

  return res.status(200).json({ status: isUnpinned });
}
