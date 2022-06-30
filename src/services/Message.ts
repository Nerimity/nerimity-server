import { UserCache } from '../cache/UserCache';
import { ChannelCache, getChannelCache } from '../cache/ChannelCache';
import { emitDMMessageCreated, emitDMMessageDeleted } from '../emits/Channel';
import { emitServerMessageCreated, emitServerMessageDeleted } from '../emits/Server';
import { ChannelModel } from '../models/ChannelModel';
import { Message, MessageModel, MessageType } from '../models/MessageModel';
import { User } from '../models/UserModel';
import { dismissChannelNotification } from './Channel';

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
  creator?: UserCache,
  channelId: string,
  channel: ChannelCache,
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

  // update channel last message
  await ChannelModel.findOneAndUpdate({ _id: opts.channelId }, { $set: {lastMessagedAt: message.createdAt} });
  // update sender last seen
  await dismissChannelNotification(opts.userId, opts.channelId, false);
  
  
  // emit 
  if (opts.serverId) {
    emitServerMessageCreated(opts.serverId, populated, opts.socketId);
    return populated;
  }
  
  const channel = opts.channel || await getChannelCache(opts.channelId);


  if (!channel.recipient) {
    throw new Error('Channel not found!');
  }

  emitDMMessageCreated(channel, populated, opts.socketId);
  

  return populated;
};



interface MessageDeletedOptions {
  messageId: string,
  channelId: string,
  channel: ChannelCache,
  recipientId?: string,
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
  
  
  const channel = opts.channel || await getChannelCache(opts.channelId);


  if (!channel.recipient) {
    throw new Error('Channel not found!');
  }
  emitDMMessageDeleted(channel, message.createdBy.toString(), {channelId: opts.channelId, messageId: opts.messageId});
  return true;
};