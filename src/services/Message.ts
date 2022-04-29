import { emitServerMessageCreated } from '../emits/Server';
import { MessageModel, MessageType } from '../models/MessageModel';
import { User } from '../models/UserModel';

export const getMessagesByChannelId = async (channelId: string, limit = 50) => {
  const messages = await MessageModel
    .find({ channel: channelId })
    .populate<{creator: User}>('creator', 'username tag hexColor')
    .limit(limit)
    .select('-__v');

  return messages;
};


interface SendMessageOptions {
  userId: string,
  channelId: string,
  serverId?: string,
  socketId?: string,
  content?: string,
  type: MessageType,
}

export const createMessage = async (opts: SendMessageOptions) => {
  const message = await MessageModel.create({
    content: opts.content,
    creator: opts.userId,
    channel: opts.channelId,
    type: opts.type
  });

  const populatedMessage = (await message.populate<{creator: User}>('creator', 'username tag hexColor')).toObject({versionKey: false});

  // emit 
  if (opts.serverId) {
    emitServerMessageCreated(opts.serverId, populatedMessage, opts.socketId);
  }
  return populatedMessage;
};