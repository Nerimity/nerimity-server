import { ChannelCache, getChannelCache } from '../cache/ChannelCache';
import { emitDMMessageCreated, emitDMMessageDeleted, emitDMMessageUpdated } from '../emits/Channel';
import { emitServerMessageCreated, emitServerMessageDeleted, emitServerMessageUpdated } from '../emits/Server';
import { MessageType } from '../types/Message';
import { dismissChannelNotification } from './Channel';
import { dateToDateTime, exists, prisma } from '../common/database';
import { generateId } from '../common/flakeId';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import { Message } from '@prisma/client';

export const getMessagesByChannelId = async (channelId: string, limit = 50, afterMessageId?: string) => {
  const messages = await prisma.message.findMany({
    where: {channelId},
    ...(afterMessageId ? {
      cursor: {id: afterMessageId},
      skip: 1
    } : undefined),
    include: {createdBy: {select: {id: true, username: true, tag: true, hexColor: true}}},
    take: limit,
    orderBy: {createdAt: 'desc'},
  });
  return messages.reverse();
};


interface EditMessageOptions {
  userId: string,
  channelId: string,
  channel?: ChannelCache | null,
  serverId?: string,
  content: string,
  messageId: string
}

export const editMessage = async (opts: EditMessageOptions): Promise<CustomResult<Partial<Message>, CustomError >> => {

  const messageExists = await exists(prisma.message, {where: {id: opts.messageId, createdById: opts.userId}});

  if (!messageExists) {
    return [null, generateError('Message does not exist or is not created by you.')];
  }

  const content = opts.content.trim();

  if (!content) {
    return [null, generateError('Content is required', 'content')];
  }

  const message = await prisma.message.update({
    where: {id: opts.messageId},
    data: {
      content,
      editedAt: dateToDateTime(),
    },
    include: {createdBy: {select: {id: true, username: true, tag: true, hexColor: true}}},
  });
  
  
  // emit 
  if (opts.serverId) {
    emitServerMessageUpdated(opts.channelId, opts.messageId, message);
    return [message, null];
  }
  
  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
  }


  if (!channel?.inbox?.recipientId) {
    return [null, generateError('Channel not found!')];
  }

  emitDMMessageUpdated(channel, opts.messageId, message);

  return [message, null];
};
interface SendMessageOptions {
  userId: string,
  channelId: string,
  channel?: ChannelCache | null,
  serverId?: string,
  socketId?: string,
  content?: string,
  type: MessageType,
  updateLastSeen?: boolean // by default, this is true.
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
  await prisma.channel.update({where: {id: opts.channelId}, data: {lastMessagedAt: dateToDateTime(message.createdAt)}});
  // update sender last seen
  opts.updateLastSeen !== false && await dismissChannelNotification(opts.userId, opts.channelId, false);

  
  
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
        createdAt: dateToDateTime(message.createdAt),
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