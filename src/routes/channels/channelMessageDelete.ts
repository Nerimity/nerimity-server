import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { prisma } from '../../common/database';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { deleteMessage } from '../../services/Message';

export function channelMessageDelete(Router: Router) {
  Router.delete('/channels/:channelId/messages/:messageId', 
    authenticate(),
    channelVerification(),
    memberHasRolePermission(ROLE_PERMISSIONS.MANAGE_CHANNELS, {continueOnError: true}),
    route
  );
}


async function route (req: Request, res: Response) {
  const { messageId } = req.params;

  // check if message exists.
  const message = await prisma.message.findFirst({where: {id: messageId}});


  if (!message) return res.status(404).json(generateError('Message not found!'));

  // check if message created by me
  const isCreatedByMe = message.createdById === req.accountCache.user.id;
  const isServerChannel = req.channelCache.server;

  if (isServerChannel && !isCreatedByMe) {
    if (req.errorMessage) return res.status(403).json(generateError(req.errorMessage));
  }

  if (!isServerChannel && !isCreatedByMe) {
    return res.status(403).json(generateError('Only the creator of the message can delete this message!'));
  }

  const isMessageDeleted = await deleteMessage({channelId: req.channelCache.id, channel: req.channelCache ,messageId, serverId: req.channelCache.server?.id, recipientId: req.channelCache.inbox?.recipientId});
  if (!isMessageDeleted) return res.status(500).json(generateError('Could not delete message!'));

  return res.status(200).json({ message: 'Message deleted!' });
}