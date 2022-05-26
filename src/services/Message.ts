import { UserCache } from '../cache/UserCache';
import { emitDMMessageCreated, emitDMMessageDeleted } from '../emits/Channel';
import { emitServerMessageCreated, emitServerMessageDeleted } from '../emits/Server';
import { ChannelModel } from '../models/ChannelModel';
import { Message, MessageModel, MessageType } from '../models/MessageModel';
import { User } from '../models/UserModel';

export const getMessagesByChannelId = async (channelId: string, limit = 50) => {
  const messages = await MessageModel
    .find({ channel: channelId })
    .populate<{createdBy: User}>('createdBy', 'username tag hexColor')
    .sort({_id: -1})
    .limit(limit)
    .select('-__v');

  return messages.reverse();
};


interface SendMessageOptions {
  userId: string,
  channelId: string,
  recipientIds?: string[],
  creator?: UserCache,
  serverId?: string,
  socketId?: string,
  content?: string,
  type: MessageType,
}

export const createMessage = async (opts: SendMessageOptions) => {
  const message = await MessageModel.create({
    content: opts.content,
    createdBy: opts.userId,
    channel: opts.channelId,
    type: opts.type
  });


  let populated: Omit<Message, 'createdBy'> &  {createdBy: UserCache};
  

  if (opts.creator) {
    populated = {...message.toObject({versionKey: false}), createdBy: opts.creator};
  } else {
    populated = (await message.populate<{createdBy: User}>('createdBy', 'username tag hexColor')).toObject({versionKey: false});
  }
  
  
  // emit 
  if (opts.serverId) {
    emitServerMessageCreated(opts.serverId, populated, opts.socketId);
    return populated;
  } 

  let recipientIds = opts.recipientIds;

  if (!recipientIds) {
    const channel = await ChannelModel.findById(opts.channelId).populate('recipients');
    if (!channel) {
      throw new Error('Channel not found!');
    }
    recipientIds = channel.recipients?.map(r => r._id.toString());
  }

  if (!recipientIds) {
    throw new Error('No recipients found!');
  }
  emitDMMessageCreated(recipientIds, populated, opts.socketId);
  

  return populated;
};



interface MessageDeletedOptions {
  messageId: string,
  channelId: string,
  recipientIds?: string[],
  serverId?: string,
}

export const deleteMessage = async (opts: MessageDeletedOptions) => {
  const message = await MessageModel.findOne({ _id: opts.messageId, channel: opts.channelId });
  if (!message) return false;
  
  await message.remove();

  if (opts.serverId) {
    emitServerMessageDeleted(opts.serverId, {channelId: opts.channelId, messageId: opts.messageId});
    return true;
  }
  
  let recipientIds = opts.recipientIds;
  
  if (!recipientIds) {
    const channel = await ChannelModel.findById(opts.channelId).populate('recipients');
    if (!channel) {
      throw new Error('Channel not found!');
    }
    recipientIds = channel.recipients?.map(r => r._id.toString());
  }
  if (!recipientIds) {
    throw new Error('No recipients found!');
  }
  emitDMMessageDeleted(recipientIds, {channelId: opts.channelId, messageId: opts.messageId});
  return true;
};