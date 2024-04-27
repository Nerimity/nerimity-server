import { Request, Response, Router } from 'express';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS } from '../../common/Bitwise';
import { emitInboxTyping, emitServerTyping } from '../../emits/Channel';
import { authenticate } from '../../middleware/authenticate';
import { channelPermissions } from '../../middleware/channelPermissions';
import { channelVerification } from '../../middleware/channelVerification';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';

export function channelTypingIndicator(Router: Router) {
  Router.post(
    '/channels/:channelId/typing',
    authenticate({allowBot: true}),
    channelVerification(),
    channelPermissions({
      bit: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
      message: 'You are not allowed to send messages in this channel.',
    }),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.SEND_MESSAGE),
    rateLimit({
      name: 'channel_typing',
      restrictMS: 10000,
      requests: 25,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const server = req.serverCache;
  const channel = req.channelCache;
  const typingUser = req.userCache;

  if (server) {
    emitServerTyping(channel.id, typingUser.id);
    res.status(204).end();
    return;
  }
  if (channel.inbox) {
    emitInboxTyping(channel.id, channel.inbox, typingUser.id);
    res.status(204).end();
    return;
  }
}
