import { Request, Response, Router } from 'express';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { MessageModel } from '../../models/MessageModel';
import { deleteMessage } from '../../services/Message';

export function channelMessageDelete(Router: Router) {
  Router.delete('/channels/:channelId/messages/:messageId', 
    authenticate(),
    channelVerification(),
    route
  );
}


async function route (req: Request, res: Response) {
  const { messageId } = req.params;

  // check if message exists.
  const message = await MessageModel.findOne({ _id: messageId });

  if (!message) return res.status(404).json(generateError('Message not found!'));

  // check if message created by me
  const isCreatedByMe = message.createdBy.toString() === req.accountCache.user._id.toString();
  const isServerChannel = req.channelCache.server;
  const isServerOwner = req.channelCache.server?.createdBy.toString() === req.accountCache.user._id.toString();

  if (isServerChannel && (!isServerOwner && !isCreatedByMe)) {
    return res.status(403).json(generateError('You are not allowed to delete messages in this channel!'));
  }
  if (isServerChannel && !isCreatedByMe) {
    return res.status(403).json(generateError('Only the creator of the message can delete this message!'));
  }

  const isMessageDeleted = await deleteMessage({messageId, serverId: req.channelCache.server?._id});

  if (!isMessageDeleted) return res.status(500).json(generateError('Could not delete message!'));

  return res.status(200).json({ message: 'Message deleted!' });

}