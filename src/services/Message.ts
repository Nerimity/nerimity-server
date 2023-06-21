import { ChannelCache, getChannelCache } from '../cache/ChannelCache';
import {
  emitDMMessageCreated,
  emitDMMessageDeleted,
  emitDMMessageReactionAdded,
  emitDMMessageUpdated,
} from '../emits/Channel';
import {
  emitServerMessageCreated,
  emitServerMessageDeleted,
  emitServerMessageReactionAdded,
  emitServerMessageReactionRemoved,
  emitServerMessageUpdated,
} from '../emits/Server';
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
import { getOGTags } from '../common/OGTags';
import { Channel } from 'diagnostics_channel';
import { sendServerPushMessageNotification } from '../fcm/pushNotification';
import { ServerCache, getServerCache } from '../cache/ServerCache';

interface GetMessageByChannelIdOpts {
  limit?: number;
  beforeMessageId?: string;
  aroundMessageId?: string;
  afterMessageId?: string;
  requesterId?: string;
}

export const getMessagesByChannelId = async (
  channelId: string,
  opts?: GetMessageByChannelIdOpts
) => {
  const limit = opts?.limit || 50;
  if (limit > 100) return [];

  if (opts?.aroundMessageId) {
    const halfLimit = Math.round(limit / 2);
    const [before, after]: any = await Promise.all([
      getMessagesByChannelId(channelId, {
        limit: halfLimit,
        beforeMessageId: opts.aroundMessageId + 1,
        requesterId: opts.requesterId,
      }),
      getMessagesByChannelId(channelId, {
        limit: halfLimit,
        afterMessageId: opts.aroundMessageId,
        requesterId: opts.requesterId,
      }),
    ]);

    const result = [...before, ...after];
    return result;
  }

  const messages = await prisma.message.findMany({
    where: {
      channelId,
      ...(opts?.beforeMessageId
        ? {
            id: { lt: opts.beforeMessageId },
          }
        : undefined),
      ...(opts?.afterMessageId
        ? {
            id: { gt: opts.afterMessageId },
          }
        : undefined),
    },
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
          badges: true,
        },
      },
      mentions: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
        },
      },
      quotedMessages: {
        select: {
          id: true,
          content: true,
          mentions: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
            },
          },
          editedAt: true,
          createdAt: true,
          channelId: true,
          attachments: {
            select: { height: true, width: true, path: true, id: true },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
              badges: true,
            },
          },
        },
      },
      reactions: {
        select: {
          ...(opts?.requesterId
            ? { reactedUsers: { where: { id: opts.requesterId } } }
            : undefined),
          emojiId: true,
          gif: true,
          name: true,
          _count: {
            select: {
              reactedUsers: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      },
      attachments: {
        select: { height: true, width: true, path: true, id: true },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    ...(opts?.afterMessageId
      ? {
          orderBy: { createdAt: 'asc' },
        }
      : undefined),
  });

  const modifiedMessages = messages.map((message) => {
    (message.reactions as any) = message.reactions.map((reaction) => ({
      ...reaction,
      reacted: !!reaction.reactedUsers?.length,
      count: reaction._count.reactedUsers,
      reactedUsers: undefined,
      _count: undefined,
    }));
    return message;
  });

  if (opts?.afterMessageId) return modifiedMessages;

  return modifiedMessages.reverse();
};

// delete messages sent in the last 7 hours
export const deleteRecentMessages = async (
  userId: string,
  serverId: string
) => {
  const date = new Date();
  date.setHours(date.getHours() + 7);

  await prisma.message.deleteMany({
    where: {
      createdById: userId,
      channel: { serverId },
      createdAt: {
        lt: dateToDateTime(date),
      },
    },
  });
};

interface EditMessageOptions {
  userId: string;
  channelId: string;
  channel?: ChannelCache | null;
  serverId?: string;
  content: string;
  messageId: string;
}

export const editMessage = async (
  opts: EditMessageOptions
): Promise<CustomResult<Partial<Message>, CustomError>> => {
  const messageExists = await exists(prisma.message, {
    where: { id: opts.messageId, createdById: opts.userId },
  });

  if (!messageExists) {
    return [
      null,
      generateError('Message does not exist or is not created by you.'),
    ];
  }

  const content = opts.content.trim();

  if (!content) {
    return [null, generateError('Content is required', 'content')];
  }

  const message = await prisma.message.update({
    where: { id: opts.messageId },
    data: await constructData(
      {
        content,
        editedAt: dateToDateTime(),
      },
      true
    ),
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
          badges: true,
        },
      },
      mentions: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
        },
      },
      quotedMessages: {
        select: {
          id: true,
          content: true,
          mentions: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
            },
          },
          editedAt: true,
          createdAt: true,
          channelId: true,
          attachments: {
            select: { height: true, width: true, path: true, id: true },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
              badges: true,
            },
          },
        },
      },
      attachments: {
        select: { height: true, width: true, path: true, id: true },
      },
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

  if (channel?.inbox?.recipientId) {
    emitDMMessageUpdated(channel, opts.messageId, message);
  }

  return [message, null];
};
interface SendMessageOptions {
  userId: string;
  channelId: string;
  channel?: ChannelCache | null;
  server?: ServerCache | null;
  serverId?: string;
  socketId?: string;
  content?: string;
  type: MessageType;
  updateLastSeen?: boolean; // by default, this is true.
  attachment?: { width?: number; height?: number; path: string };
}

type MessageDataCreate = Parameters<typeof prisma.message.create>[0]['data'];
type MessageDataUpdate = Parameters<typeof prisma.message.update>[0]['data'];

const userMentionRegex = /\[@:([\d]+)]/g;
const quoteMessageRegex = /\[q:([\d]+)]/g;

function constructData(
  messageData: MessageDataUpdate,
  update: true
): Promise<any>;
function constructData(
  messageData: MessageDataCreate,
  update?: false | undefined
): Promise<any>;

async function constructData(
  messageData: MessageDataCreate | MessageDataUpdate,
  update?: boolean
) {
  if (typeof messageData.content === 'string') {
    const mentionUserIds = removeDuplicates(
      [...messageData.content.matchAll(userMentionRegex)].map((m) => m[1])
    );

    if (mentionUserIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: mentionUserIds } },
        select: { id: true },
      });
      messageData.mentions = {
        ...(update ? { set: users } : { connect: users }),
      };
    }

    const quotedMessageIds = removeDuplicates(
      [...messageData.content.matchAll(quoteMessageRegex)].map((m) => m[1])
    ).slice(0, 5);
    if (quotedMessageIds.length) {
      const messages = await prisma.message.findMany({
        where: { id: { in: quotedMessageIds }, type: MessageType.CONTENT },
        select: { id: true },
      });
      messageData.quotedMessages = {
        ...(update ? { set: messages } : { connect: messages }),
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
      ...(opts.attachment
        ? {
            attachments: {
              create: {
                id: generateId(),
                channelId: opts.channelId,
                serverId: opts.serverId,
                height: opts.attachment.height,
                width: opts.attachment.width,
                path: opts.attachment.path,
              },
            },
          }
        : undefined),
    }),
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
          badges: true,
        },
      },
      mentions: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
        },
      },
      quotedMessages: {
        select: {
          id: true,
          content: true,
          mentions: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
            },
          },
          editedAt: true,
          createdAt: true,
          channelId: true,
          attachments: {
            select: { height: true, width: true, path: true, id: true },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
              badges: true,
            },
          },
        },
      },
      attachments: {
        select: { height: true, width: true, path: true, id: true },
      },
      reactions: true,
    },
  });

  // update channel last message
  const updateLastMessageQuery = prisma.channel.update({
    where: { id: opts.channelId },
    data: { lastMessagedAt: messageCreatedAt },
  });

  const [message] = await prisma.$transaction([
    createMessageQuery,
    updateLastMessageQuery,
  ]);

  // update sender last seen
  opts.updateLastSeen !== false &&
    (await dismissChannelNotification(opts.userId, opts.channelId, false));

  if (message.mentions.length && opts.serverId) {
    const userIds = message.mentions.map((mention) => mention.id);
    const usersInServer = await prisma.user.findMany({
      where: {
        id: { in: userIds, not: opts.userId },
        servers: { some: { id: opts.serverId } },
      },
      select: { id: true },
    });
    await prisma.$transaction(
      usersInServer.map((user) =>
        prisma.messageMention.upsert({
          where: {
            mentionedById_mentionedToId_channelId: {
              channelId: opts.channelId,
              mentionedById: opts.userId,
              mentionedToId: user.id,
            },
          },
          update: {
            count: { increment: 1 },
          },
          create: {
            id: generateId(),
            count: 1,
            channelId: opts.channelId,
            mentionedById: opts.userId,
            mentionedToId: user.id,
            serverId: opts.serverId,
            createdAt: dateToDateTime(message.createdAt),
          },
        })
      )
    );
  }

  // emit
  let channel = opts.channel;
  let server = opts.server;

  if (opts.serverId) {
    emitServerMessageCreated(message, opts.socketId);
    if (!channel) {
      [channel] = await getChannelCache(opts.channelId, opts.userId);
    }
    if (!server) {
      server = await getServerCache(opts.serverId);
    }
    sendServerPushMessageNotification(
      opts.serverId,
      message,
      channel!,
      server!
    );
  }

  if (!opts.serverId) {
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
            mentionedToId: channel.inbox.recipientId,
          },
        },
        update: {
          count: { increment: 1 },
        },
        create: {
          id: generateId(),
          count: 1,
          channelId: channel.id,
          mentionedById: opts.userId,
          mentionedToId: channel.inbox.recipientId,
          createdAt: dateToDateTime(message.createdAt),
        },
      });
    }

    emitDMMessageCreated(channel, message, opts.socketId);
  }

  if (message.type === MessageType.CONTENT) {
    addMessageEmbed(message, { channel, serverId: opts.serverId });
  }
  return message;
};
const urlRegex = new RegExp(
  '(^|[ \t\r\n])((http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))'
);

const addMessageEmbed = async (
  message: Message,
  opts: { serverId?: string; channel?: ChannelCache | null }
) => {
  const url = message.content?.match(urlRegex)?.[0].trim();
  if (!url) return;
  const OGTags = await getOGTags(url);
  if (!OGTags) return;
  await prisma.message.update({
    where: { id: message.id },
    data: { embed: OGTags },
  });
  // emit
  if (opts.serverId) {
    emitServerMessageUpdated(message.channelId, message.id, { embed: OGTags });
    return;
  }
  if (!opts.serverId && opts.channel) {
    emitDMMessageUpdated(opts.channel, message.id, { embed: OGTags });
  }
};

interface MessageDeletedOptions {
  messageId: string;
  channelId: string;
  channel?: ChannelCache | null;
  recipientId?: string;
  serverId?: string;
}

export const deleteMessage = async (opts: MessageDeletedOptions) => {
  const message = await prisma.message.findFirst({
    where: { id: opts.messageId, channelId: opts.channelId },
    include: { attachments: true },
  });
  if (!message) return false;

  await prisma.message.delete({ where: { id: opts.messageId } });

  if (message.attachments?.[0]?.path) {
    deleteImage(message.attachments[0].path);
  }

  if (opts.serverId) {
    emitServerMessageDeleted({
      channelId: opts.channelId,
      messageId: opts.messageId,
    });
    return true;
  }

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, message.createdById);
  }

  if (!channel?.inbox?.recipientId) {
    throw new Error('Channel not found!');
  }
  emitDMMessageDeleted(channel, {
    channelId: opts.channelId,
    messageId: opts.messageId,
  });
  return true;
};

interface AddReactionOpts {
  messageId: string;
  channelId: string;
  channel?: ChannelCache | null;
  serverId?: string;
  reactedByUserId: string;

  name: string;
  emojiId?: string;
  gif?: boolean;
}

export const addMessageReaction = async (opts: AddReactionOpts) => {
  const message = await prisma.message.findFirst({
    where: {
      id: opts.messageId,
      channelId: opts.channelId,
    },
    include: {
      reactions: {
        where: {
          messageId: opts.messageId,
          ...addToObjectIfExists('emojiId', opts.emojiId),
          ...addToObjectIfExists('name', opts.name),
        },

        include: {
          _count: {
            select: { reactedUsers: { where: { id: opts.reactedByUserId } } },
          },
        },
      },
    },
  });

  if (!message) return [null, generateError('Invalid messageId')] as const;

  // check if already reacted
  const existingReaction = message.reactions[0] as
    | (typeof message.reactions)[0]
    | undefined;

  if (existingReaction?._count.reactedUsers) {
    return [null, generateError('You have already reacted.')] as const;
  }

  let newCount = 0;

  if (existingReaction?.id) {
    const reaction = await prisma.messageReaction.update({
      where: { id: existingReaction.id },
      data: { reactedUsers: { connect: { id: opts.reactedByUserId } } },
      select: { _count: { select: { reactedUsers: true } } },
    });
    newCount = reaction._count.reactedUsers;
  }

  if (!existingReaction?.id) {
    const uniqueEmojiCount = await prisma.messageReaction.count({
      where: { messageId: opts.messageId },
    });
    if (uniqueEmojiCount >= 15) {
      return [null, generateError('Too many reactions.')] as const;
    }
    const reaction = await prisma.messageReaction.create({
      data: {
        id: generateId(),
        name: opts.name,
        emojiId: opts.emojiId,
        gif: opts.gif,
        messageId: opts.messageId,
        reactedUsers: { connect: { id: opts.reactedByUserId } },
      },
      select: { _count: { select: { reactedUsers: true } } },
    });
    newCount = reaction._count.reactedUsers;
  }

  const payload = {
    reactedByUserId: opts.reactedByUserId,
    messageId: opts.messageId,
    channelId: opts.channelId,
    emojiId: opts.emojiId,
    name: opts.name,
    gif: opts.gif,
    count: newCount,
  };

  // emit
  if (opts.serverId) {
    emitServerMessageReactionAdded(opts.channelId, payload);
    return [message, null];
  }

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.reactedByUserId);
  }

  if (channel?.inbox?.recipientId) {
    emitDMMessageReactionAdded(channel, payload);
  }

  return [payload, null] as const;
};

interface RemoveReactionOpts {
  messageId: string;
  channelId: string;
  channel?: ChannelCache | null;
  serverId?: string;
  reactionRemovedByUserId: string;

  name: string;
  emojiId?: string;
}

export const removeMessageReaction = async (opts: RemoveReactionOpts) => {
  const message = await prisma.message.findFirst({
    where: {
      id: opts.messageId,
      channelId: opts.channelId,
    },
    include: {
      reactions: {
        where: {
          messageId: opts.messageId,
          ...addToObjectIfExists('emojiId', opts.emojiId),
          ...addToObjectIfExists('name', opts.name),
        },

        include: {
          _count: {
            select: {
              reactedUsers: { where: { id: opts.reactionRemovedByUserId } },
            },
          },
        },
      },
    },
  });

  if (!message) return [null, generateError('Invalid messageId')] as const;

  // check if already reacted
  const existingReaction = message.reactions[0] as
    | (typeof message.reactions)[0]
    | undefined;

  if (!existingReaction?._count?.reactedUsers) {
    return [null, generateError('You have already not reacted')] as const;
  }

  const reactionCount = await prisma.messageReaction.findFirst({
    where: { id: existingReaction.id },
    select: { _count: { select: { reactedUsers: true } } },
  });
  if (!reactionCount) return [null, generateError('Invalid Reaction')] as const;

  if (reactionCount?._count.reactedUsers === 1) {
    await prisma.messageReaction.delete({ where: { id: existingReaction.id } });
  }

  if (reactionCount?._count.reactedUsers > 1) {
    await prisma.messageReaction.update({
      where: { id: existingReaction.id },
      data: {
        reactedUsers: {
          disconnect: { id: opts.reactionRemovedByUserId },
        },
      },
    });
  }

  const payload = {
    reactionRemovedByUserId: opts.reactionRemovedByUserId,
    messageId: opts.messageId,
    channelId: opts.channelId,
    emojiId: opts.emojiId,
    name: opts.name,
    count: reactionCount._count.reactedUsers - 1,
  };

  // emit
  if (opts.serverId) {
    emitServerMessageReactionRemoved(opts.channelId, payload);
    return [message, null];
  }

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(
      opts.channelId,
      opts.reactionRemovedByUserId
    );
  }

  if (channel?.inbox?.recipientId) {
    emitDMMessageReactionAdded(channel, payload);
  }

  return [payload, null] as const;
};
