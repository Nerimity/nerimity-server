import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { pinMessage } from '../../services/Message/Message';
import { ChannelType } from '../../types/Channel';
import { rateLimit } from '@src/middleware/rateLimit';

export function channelMessagePinAdd(Router: Router) {
  Router.post(
    '/channels/:channelId/messages/pins/:messageId',
    authenticate({ allowBot: false }),
    channelVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.MANAGE_CHANNELS, {
      continueOnError: true,
    }),
    rateLimit({
      name: 'pin_add',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const params = req.params;

  if (req.channelCache.type === ChannelType.TICKET) {
    return res.status(400).json({ error: 'Ticket message cannot be pinned.' });
  }

  const isServerChannel = req.channelCache.type === ChannelType.SERVER_TEXT && req.channelCache.server;

  if (isServerChannel) {
    if (req.errorMessage) return res.status(403).json(generateError(req.errorMessage));
  }

  const [isPinned, error] = await pinMessage({
    channelId: req.channelCache.id,
    messageId: params.messageId!,
    channelCache: req.channelCache,
    serverCache: req.serverCache,
    userId: req.userCache.id,
  });
  if (error) return res.status(500).json(error);

  return res.status(200).json({ status: isPinned });
}
