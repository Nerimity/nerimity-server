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
import { removeDuplicates } from '../common/utils';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { deleteImage } from '../common/nerimityCDN';

export const getMessagesByChannelId = async (channelId: string, limit = 50, afterMessageId?: string, beforeMessageId?: string) => {
  if (limit > 100) return [];
  const messages = await prisma.message.findMany({
    where: {
      channelId,
      ...(afterMessageId ? {
        id: {lt: afterMessageId}
      } : undefined),
      ...(beforeMessageId ? {
        id: {gt: beforeMessageId}
      } : undefined)
    },
    include: {
      createdBy: {select: {id: true, username: true, tag: true, hexColor: true, avatar: true, badges: true}},
      mentions: {select: {id: true, username: true, tag: true, hexColor: true, avatar: true}},
      attachments: {select: {height: true, width: true, path: true, id: true}}
    },
    take: limit,
    orderBy: {createdAt: 'desc'},
    ...(beforeMessageId ? {
      orderBy: {createdAt: 'asc'},
    } : undefined),
  });

  if (beforeMessageId) return messages;

  return messages.reverse();
};


// delete messages sent in the last 7 hours
export const deleteRecentMessages = async (userId: string, serverId: string) => {
  const date = new Date();
  date.setHours(date.getHours() + 7);

  await prisma.message.deleteMany({
    where: {
      createdById: userId,
      channel: { serverId },
      createdAt: {
        lt: dateToDateTime(date),
      }
    }
  });
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
    data: await constructData({
      content,
      editedAt: dateToDateTime(),
    }, true),
    include: {
      createdBy: {select: {id: true, username: true, tag: true, hexColor: true, avatar: true, badges: true}},
      mentions: {select: {id: true, username: true, tag: true, hexColor: true, avatar: true}},
      attachments: {select: {height: true, width: true, path: true, id: true}}
    },
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
  attachment?: {width?: number, height?: number, path: string}
}


type MessageDataCreate = Parameters<typeof prisma.message.create>[0]['data'];

type MessageDataUpdate = Parameters<typeof prisma.message.update>[0]['data'];

const userMentionRegex =/\[@:([\d]+)]/g;

function constructData(messageData: MessageDataUpdate, update: true): Promise<any> 
function constructData(messageData: MessageDataCreate, update?: false | undefined): Promise<any> 

async function constructData(messageData: MessageDataCreate | MessageDataUpdate, update?: boolean){
  if (typeof messageData.content === 'string') {
    const mentionUserIds = removeDuplicates([...messageData.content.matchAll(userMentionRegex)].map(m => m[1]));

    if (mentionUserIds.length) {
      const mentionedUsers = await prisma.user.findMany({where: {id: {in: mentionUserIds}}, select: {id: true}});
      messageData.mentions = {
        ...(update ? {set: mentionedUsers} : {connect: mentionedUsers}),
      };
    }

  }
  return messageData;
}

export const createMessage = async (opts: SendMessageOptions) => {
  const messageCreatedAt = dateToDateTime();
  const createMessageQuery = prisma.message.create({
    data: await constructData({
      id: generateId(),
      content: opts.content || '',
      createdById: opts.userId,
      channelId: opts.channelId,
      type: opts.type,
      createdAt: messageCreatedAt,
      ...(opts.attachment ? {
        attachments: {
          create: {
            id: generateId(),
            channelId: opts.channelId,
            serverId: opts.serverId,
            height: opts.attachment.height,
            width: opts.attachment.width,
            path: opts.attachment.path,
          }
        }
      } : undefined)
    }),
    include: {
      createdBy: {select: {id: true, username: true, tag: true, hexColor: true, avatar: true, badges: true}},
      mentions: {select: {id: true, username: true, tag: true, hexColor: true, avatar: true}},
      attachments: {select: {height: true, width: true, path: true, id: true}}
    },
  });

  // update channel last message
  const updateLastMessageQuery = prisma.channel.update({where: {id: opts.channelId}, data: {lastMessagedAt: messageCreatedAt}});

  const [message] = await prisma.$transaction([createMessageQuery, updateLastMessageQuery]);

  // update sender last seen
  opts.updateLastSeen !== false && await dismissChannelNotification(opts.userId, opts.channelId, false);

  if (message.mentions.length && opts.serverId) {
    const userIds = message.mentions.map(mention => mention.id);
    const usersInServer = await prisma.user.findMany({where: {id: {in: userIds, not: opts.userId}, servers: {some: {id: opts.serverId}}}, select: {id: true}});
    await prisma.$transaction(usersInServer.map(user => prisma.messageMention.upsert({
      where: {
        mentionedById_mentionedToId_channelId: {
          channelId: opts.channelId,
          mentionedById: opts.userId,
          mentionedToId: user.id
        }
      },
      update: {
        count: {increment: 1}
      },
      create: {
        id: generateId(),
        count: 1,
        channelId: opts.channelId,
        mentionedById: opts.userId,
        mentionedToId: user.id,
        serverId: opts.serverId,
        createdAt: dateToDateTime(message.createdAt),
      }
    })));
  }


  
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
  const message = await prisma.message.findFirst({ where: {id: opts.messageId, channelId: opts.channelId}, include: {attachments: true} });
  if (!message) return false;
  
  await prisma.message.delete({where: {id: opts.messageId}});

  if (message.attachments?.[0]?.path) {
    deleteImage(message.attachments[0].path);
  }


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