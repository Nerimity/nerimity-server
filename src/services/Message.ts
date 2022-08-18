import { UserCache } from '../cache/UserCache';
import { ChannelCache, getChannelCache } from '../cache/ChannelCache';
import { emitDMMessageCreated, emitDMMessageDeleted } from '../emits/Channel';
import { emitServerMessageCreated, emitServerMessageDeleted } from '../emits/Server';
import { MessageType } from '../models/MessageModel';
import { dismissChannelNotification } from './Channel';
import { prisma } from '../common/database';
import { generateId } from '../common/flakeId';

export const getMessagesByChannelId = async (channelId: string, limit = 50) => {

  const messages = await prisma.message.findMany({
    where: {channelId},
    include: {createdBy: {select: {id: true, username: true, tag: true, hexColor: true}}},
    take: limit,
    orderBy: {createdAt: 'desc'},
  });
  return messages.reverse();
};


interface SendMessageOptions {
  userId: string,
  creator?: UserCache,
  channelId: string,
  channel?: ChannelCache | null,
  serverId?: string,
  socketId?: string,
  content?: string,
  type: MessageType,
}

export const createMessage = async (opts: SendMessageOptions) => {
  const message = await prisma.message.create({
    data: {
      id: generateId(),
      content: opts.content || '',
      createdById: opts.userId,
      channelId: opts.channelId,
      type: opts.type      
    },
    include: {createdBy: {select: {id: true, username: true, tag: true, hexColor: true}}},
  });


  // update channel last message
  await prisma.channel.update({where: {id: opts.channelId}, data: {lastMessagedAt: message.createdAt}});
  // update sender last seen
  await dismissChannelNotification(opts.userId, opts.channelId, false);

  
  
  // emit 
  if (opts.serverId) {
    emitServerMessageCreated(message, opts.socketId);
    return message;
  }
  
  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
  }


  if (!channel?.inbox?.recipientId) {
    throw new Error('Channel not found!');
  }


  // For DM channels, mentions are notifications for everything.
  // For Server channels, mentions are notifications for @mentions.
  // Don't send notifications for saved notes
  if (channel.inbox.recipientId !== channel.inbox.createdById) {
    await prisma.messageMention.upsert({
      where: {
        mentionedById_mentionedToId_channelId: {
          channelId: channel.id,
          mentionedById: opts.userId,
          mentionedToId:channel.inbox.recipientId
        }
      },
      update: {
        count: {increment: 1}
      },
      create: {
        id: generateId(),
        count: 1,
        channelId: channel.id,
        mentionedById: opts.userId,
        mentionedToId: channel.inbox.recipientId,
        serverId: channel.server?.id,
        createdAt: message.createdAt,
      }
    });
  }



  emitDMMessageCreated(channel, message, opts.socketId);
  

  return message;
};



interface MessageDeletedOptions {
  messageId: string,
  channelId: string,
  channel?: ChannelCache | null,
  recipientId?: string,
  serverId?: string,
}

export const deleteMessage = async (opts: MessageDeletedOptions) => {
  const message = await prisma.message.findFirst({ where: {id: opts.messageId, channelId: opts.channelId} });
  if (!message) return false;
  
  await prisma.message.delete({where: {id: opts.messageId}});

  if (opts.serverId) {
    emitServerMessageDeleted({channelId: opts.channelId, messageId: opts.messageId});
    return true;
  }
  
  
  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, message.createdById);
  }


  if (!channel?.inbox?.recipientId) {
    throw new Error('Channel not found!');
  }
  emitDMMessageDeleted(channel, {channelId: opts.channelId, messageId: opts.messageId});
  return true;
};