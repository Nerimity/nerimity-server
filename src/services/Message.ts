import { ChannelCache, getChannelCache } from '../cache/ChannelCache';
import { emitButtonClick, emitButtonClickCallback, emitDMMessageCreated, emitDMMessageDeleted, emitDMMessageReactionAdded, emitDMMessageReactionRemoved, emitDMMessageUpdated } from '../emits/Channel';
import { emitServerMessageCreated, emitServerMessageDeleted, emitServerMessageDeletedBatch, emitServerMessageReactionAdded, emitServerMessageReactionRemoved, emitServerMessageUpdated } from '../emits/Server';
import { MessageType } from '../types/Message';
import { dismissChannelNotification } from './Channel';
import { dateToDateTime, exists, prisma, publicUserExcludeFields } from '../common/database';
import { generateId } from '../common/flakeId';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import { Attachment, Message, Prisma } from '@prisma/client';
import { removeDuplicates, removeDuplicates } from '../common/utils';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { deleteFile } from '../common/nerimityCDN';
import { getOGTags } from '../common/OGTags';
import { sendDmPushNotification, sendServerPushMessageNotification } from '../fcm/pushNotification';
import { ServerCache, getServerCache } from '../cache/ServerCache';
import { NotificationPingMode } from './User/User';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../common/Bitwise';
import { ChannelType } from '../types/Channel';
import { Log } from '../common/Log';
import { replaceBadWords } from '../common/badWords';
import { htmlToJson } from '@nerimity/html-embed';
import { zip } from '../common/zip';
import { FriendStatus } from '../types/Friend';
import { getIO } from '../socket/socket';

interface GetMessageByChannelIdOpts {
  limit?: number;
  beforeMessageId?: string;
  aroundMessageId?: string;
  afterMessageId?: string;
  requesterId?: string;
}

export const AttachmentProviders = {
  Local: 'local', // nerimity cdn
  GoogleDrive: 'google_drive',
} as const;

export const getMessagesByChannelId = async (channelId: string, opts?: GetMessageByChannelIdOpts) => {
  const limit = opts?.limit || 50;
  if (limit > 100) return [];
  if (limit <= 0) return [];

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
          bot: true,
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
      buttons: {
        orderBy: { order: 'asc' },
        select: {
          alert: true,
          id: true,
          label: true,
        },
      },
      replyMessages: {
        orderBy: { id: 'desc' },
        select: {
          replyToMessage: {
            select: {
              id: true,
              content: true,
              editedAt: true,
              createdAt: true,
              attachments: {
                select: {
                  height: true,
                  width: true,
                  path: true,
                  id: true,
                  provider: true,
                  fileId: true,
                  filesize: true,
                  mime: true,
                  createdAt: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  username: true,
                  tag: true,
                  hexColor: true,
                  avatar: true,
                  badges: true,
                  bot: true,
                },
              },
            },
          },
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
            select: {
              height: true,
              width: true,
              path: true,
              id: true,
              provider: true,
              filesize: true,
              fileId: true,
              mime: true,
              createdAt: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
              badges: true,
              bot: true,
            },
          },
        },
      },
      reactions: {
        select: {
          ...(opts?.requesterId ? { reactedUsers: { where: { userId: opts.requesterId } } } : undefined),
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
        select: {
          height: true,
          width: true,
          path: true,
          id: true,
          filesize: true,
          provider: true,
          fileId: true,
          mime: true,
          createdAt: true,
        },
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
export const deleteRecentUserServerMessages = async (userId: string, serverId: string) => {
  const fromTime = new Date();
  const toTime = new Date();
  toTime.setHours(toTime.getHours() + 7);

  await prisma.message.deleteMany({
    where: {
      createdById: userId,
      channel: { serverId },
      createdAt: {
        lt: dateToDateTime(toTime),
      },
    },
  });

  emitServerMessageDeletedBatch({
    userId,
    serverId,
    fromTime,
    toTime,
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

export const MessageInclude = {
  createdBy: {
    select: {
      id: true,
      username: true,
      tag: true,
      hexColor: true,
      avatar: true,
      badges: true,
      bot: true,
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
  buttons: {
    orderBy: { order: 'asc' },
    select: {
      alert: true,
      id: true,
      label: true,
    },
  },
  replyMessages: {
    orderBy: { id: 'desc' },
    select: {
      replyToMessage: {
        select: {
          id: true,
          content: true,
          editedAt: true,
          createdAt: true,
          attachments: {
            select: {
              height: true,
              width: true,
              path: true,
              id: true,
              filesize: true,
              provider: true,
              fileId: true,
              mime: true,
              createdAt: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
              badges: true,
              bot: true,
            },
          },
        },
      },
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
        select: {
          height: true,
          width: true,
          path: true,
          id: true,
          provider: true,
          filesize: true,
          fileId: true,
          mime: true,
          createdAt: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
          badges: true,
          bot: true,
        },
      },
    },
  },
  attachments: {
    select: {
      height: true,
      width: true,
      path: true,
      id: true,
      provider: true,
      filesize: true,
      fileId: true,
      mime: true,
      createdAt: true,
    },
  },
};
export const editMessage = async (opts: EditMessageOptions): Promise<CustomResult<Partial<Message>, CustomError>> => {
  const messageExists = await exists(prisma.message, {
    where: { id: opts.messageId, createdById: opts.userId },
  });

  if (!messageExists) {
    return [null, generateError('Message does not exist or is not created by you.')];
  }

  const content = opts.content.trim();

  if (!content) {
    return [null, generateError('Content is required', 'content')];
  }

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
  }
  const isServerOrDMChannel = channel?.type === ChannelType.DM_TEXT || channel?.type === ChannelType.SERVER_TEXT;

  const message = await prisma.message.update({
    where: { id: opts.messageId },
    data: await constructData({
      messageData: {
        content: isServerOrDMChannel ? replaceBadWords(opts.content) : opts.content,
        editedAt: dateToDateTime(),
        embed: Prisma.JsonNull,
      },
      creatorId: opts.userId,
      update: true,
    }),
    include: MessageInclude,
  });

  // emit
  if (opts.serverId) {
    emitServerMessageUpdated(opts.channelId, opts.messageId, message);
  }

  if (channel?.type === ChannelType.DM_TEXT && channel?.inbox?.recipientId) {
    emitDMMessageUpdated(channel, opts.messageId, message);
  }

  if (message.type === MessageType.CONTENT) {
    addMessageEmbed(message, { channel, serverId: opts.serverId });
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
  attachment?: Partial<Attachment>;
  everyoneMentioned?: boolean;
  htmlEmbed?: string;

  replyToMessageIds?: string[];
  mentionReplies?: boolean;
  silent?: boolean;

  buttons?: {
    label: string;
    id: string;
    alert?: boolean;
  }[];
}

type MessageDataCreate = Parameters<typeof prisma.message.create>[0]['data'];
type MessageDataUpdate = Parameters<typeof prisma.message.update>[0]['data'];

const userMentionRegex = /\[@:([\d]+)]/g;
const quoteMessageRegex = /\[q:([\d]+)]/g;

interface ConstructDataOpts {
  messageData: MessageDataCreate | MessageDataUpdate;
  creatorId: string;
  update?: boolean;
  bypassQuotesCheck?: boolean;
  sendMessageOpts?: SendMessageOptions;
}
async function constructData({ messageData, creatorId, update, bypassQuotesCheck, sendMessageOpts }: ConstructDataOpts) {
  if (typeof messageData.content === 'string') {
    const mentionUserIds = removeDuplicates([...messageData.content.matchAll(userMentionRegex)].map((m) => m[1]));

    if (mentionUserIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: mentionUserIds } },
        select: { id: true },
      });
      messageData.mentions = {
        ...(update ? { set: users } : { connect: users }),
      };
    }

    if (!update && sendMessageOpts?.replyToMessageIds?.length) {
      const replyToMessageIds = removeDuplicates(sendMessageOpts.replyToMessageIds);

      const validReplyToMessages = await prisma.message.findMany({
        where: { id: { in: replyToMessageIds }, channelId: sendMessageOpts?.channelId },
      });
      const validReplyToMessageIds = validReplyToMessages.map((m) => m.id);

      if (validReplyToMessageIds.length) {
        messageData.replyMessages = {
          createMany: {
            data: validReplyToMessageIds.map((id) => ({ replyToMessageId: id, id: generateId() })),
          },
        };

        if (sendMessageOpts.mentionReplies) {
          messageData.mentionReplies = sendMessageOpts.mentionReplies;
        }
      }
    }

    const quotedMessageIds = removeDuplicates([...messageData.content.matchAll(quoteMessageRegex)].map((m) => m[1])).slice(0, 8);
    if (quotedMessageIds.length) {
      const messages = await quotableMessages(quotedMessageIds, creatorId, bypassQuotesCheck);
      messageData.quotedMessages = {
        ...(update ? { set: messages } : { connect: messages }),
      };
    }
  }
  return messageData;
}

export const createMessage = async (opts: SendMessageOptions) => {
  const messageCreatedAt = dateToDateTime();

  let channel = opts.channel;
  let server = opts.server;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
  }

  const isServerOrDMChannel = channel?.type === ChannelType.DM_TEXT || channel?.type === ChannelType.SERVER_TEXT;

  let htmlEmbed = undefined;
  if (opts.htmlEmbed) {
    try {
      htmlEmbed = htmlToJson(opts.htmlEmbed);
    } catch (err: any) {
      return [null, generateError(err.message, 'htmlEmbed')];
    }
  }

  if (opts.buttons) {
    const ids = opts.buttons.map((b) => b.id);
    const uniqueButtons = removeDuplicates(ids);
    if (uniqueButtons.length !== ids.length) {
      return [null, generateError('Button IDs must be unique', 'buttons')];
    }
  }

  const createMessageQuery = prisma.message.create({
    data: await constructData({
      messageData: {
        silent: opts.silent,
        id: generateId(),
        content: isServerOrDMChannel && opts.content ? replaceBadWords(opts.content) : opts.content || '',
        createdById: opts.userId,
        channelId: opts.channelId,
        type: opts.type,
        createdAt: messageCreatedAt,

        ...(opts.buttons?.length
          ? {
            buttons: {
              createMany: {
                data: opts.buttons,
              },
            },
          }
          : undefined),

        ...(htmlEmbed ? { htmlEmbed: zip(JSON.stringify(htmlEmbed)) } : undefined),
        ...(opts.attachment
          ? {
            attachments: {
              create: {
                ...opts.attachment,
                id: generateId(),
                channelId: opts.channelId,
                serverId: opts.serverId,
              },
            },
          }
          : undefined),
      },
      creatorId: opts.userId,
      bypassQuotesCheck: channel?.type === ChannelType.TICKET,
      sendMessageOpts: opts,
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
          bot: true,
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
      replyMessages: {
        orderBy: { id: 'desc' },
        select: {
          replyToMessage: {
            select: {
              id: true,
              content: true,
              editedAt: true,
              createdAt: true,
              attachments: {
                select: {
                  height: true,
                  width: true,
                  path: true,
                  id: true,
                  provider: true,
                  filesize: true,
                  fileId: true,
                  mime: true,
                  createdAt: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  username: true,
                  tag: true,
                  hexColor: true,
                  avatar: true,
                  badges: true,
                  bot: true,
                },
              },
            },
          },
        },
      },
      buttons: {
        orderBy: { order: 'asc' },
        select: {
          alert: true,
          id: true,
          label: true,
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
            select: {
              height: true,
              width: true,
              path: true,
              id: true,
              provider: true,
              filesize: true,
              fileId: true,
              mime: true,
              createdAt: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
              badges: true,
              bot: true,
            },
          },
        },
      },
      attachments: {
        select: {
          height: true,
          width: true,
          path: true,
          id: true,
          filesize: true,
          provider: true,
          fileId: true,
          mime: true,
          createdAt: true,
        },
      },
      reactions: true,
    },
  });

  // update channel last message
  const updateLastMessageQuery = prisma.channel.update({
    where: { id: opts.channelId },
    data: { lastMessagedAt: messageCreatedAt },
  });

  const [message] = await prisma.$transaction([createMessageQuery, updateLastMessageQuery]).catch((e) => {
    console.error(e);
    return [];
  });

  if (!message) {
    return [null, "Couldn't create message"] as const;
  }

  // update sender last seen
  opts.updateLastSeen !== false && (await dismissChannelNotification(opts.userId, opts.channelId, false));

  const isServerChannel = channel?.type === ChannelType.SERVER_TEXT || channel?.type === ChannelType.CATEGORY;

  if (opts.serverId && isServerChannel) {
    if (!server) {
      server = await getServerCache(opts.serverId);
    }
    let mentionUserIds: string[] = [];

    if (opts.everyoneMentioned) {
      const serverMembers = await prisma.serverMember.findMany({
        where: { serverId: opts.serverId, NOT: { userId: opts.userId } },
        select: { userId: true },
      });
      mentionUserIds = serverMembers.map((member) => member.userId);
    } else {
      if (message.mentionReplies) {
        const userIds = message.replyMessages.map((message) => message.replyToMessage?.createdBy.id);
        if (userIds.length) {
          mentionUserIds = [...mentionUserIds, ...userIds];
        }
      }

      if (message.mentions.length) {
        mentionUserIds = message.mentions.map((mention) => mention.id);
      }

      if (message.quotedMessages.length) {
        const userIds = message.quotedMessages.map((message) => message.createdBy.id);
        mentionUserIds = [...mentionUserIds, ...userIds];
      }
    }

    if (mentionUserIds.length) {
      await addMention(removeDuplicates(mentionUserIds), opts.serverId, opts.channelId, opts.userId, message, channel!, server!);
    }
  }

  // emit
  if (opts.serverId && isServerChannel) {
    emitServerMessageCreated(message, opts.socketId);
    sendServerPushMessageNotification(opts.serverId, message, channel!, server!);
  }

  if (channel?.type === ChannelType.DM_TEXT) {
    if (!channel?.inbox?.recipientId) {
      return [null, 'Channel not found!'] as const;
    }

    // For DM channels, mentions are notifications for everything.
    // For Server channels, mentions are notifications for @mentions.
    // Don't send notifications for saved notes
    if (channel?.type === ChannelType.DM_TEXT && channel.inbox.recipientId !== channel.inbox.createdById) {
      const upsertResult = await prisma.messageMention
        .upsert({
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
        })
        .catch(console.error);
      if (!upsertResult) {
        return [null, "Couldn't create message mention"] as const;
      }
    }

    emitDMMessageCreated(channel, message, opts.socketId);

    sendDmPushNotification(message, channel!);
  }

  if (message.type === MessageType.CONTENT) {
    addMessageEmbed(message, { channel, serverId: opts.serverId });
  }
  return [message, null] as const;
};
const urlRegex = new RegExp('(^|[ \t\r\n])((http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))');

const addMessageEmbed = async (message: Message, opts: { serverId?: string; channel?: ChannelCache | null }) => {
  const url = message.content?.match(urlRegex)?.[0].trim();
  if (!url) return;
  const OGTags = await getOGTags(url);
  if (!OGTags) return;
  const res = await prisma.message
    .update({
      where: { id: message.id },
      data: { embed: OGTags },
    })
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .catch(() => { });
  if (!res) return;
  // emit
  if (opts.serverId) {
    emitServerMessageUpdated(message.channelId!, message.id, { embed: OGTags });
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
    include: { attachments: true, _count: { select: { attachments: true } } },
  });
  if (!message) return [false, 'Message not found!'] as const;

  const deleteRes = await prisma.message.delete({ where: { id: opts.messageId } }).catch(() => { });

  if (!deleteRes) {
    return [false, 'Something went wrong, try again later.'];
  }

  if (message.attachments?.[0]?.path && message.attachments[0].provider === AttachmentProviders.Local) {
    deleteFile(message.attachments[0].path);
  }

  if (opts.serverId) {
    emitServerMessageDeleted({
      channelId: opts.channelId,
      messageId: opts.messageId,
    });
    return [true, null] as const;
  }

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, message.createdById);
  }

  if (channel?.type === ChannelType.DM_TEXT && !channel?.inbox?.recipientId) {
    return [null, 'Channel not found!'] as const;
  }
  emitDMMessageDeleted(channel, {
    channelId: opts.channelId,
    messageId: opts.messageId,
    deletedAttachmentCount: message._count.attachments,
  });
  return [true, null] as const;
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
            select: { reactedUsers: { where: { userId: opts.reactedByUserId } } },
          },
        },
      },
    },
  });

  if (!message) return [null, generateError('Invalid messageId')] as const;

  // check if already reacted
  const existingReaction = message.reactions[0] as (typeof message.reactions)[0] | undefined;

  if (existingReaction?._count.reactedUsers) {
    return [null, generateError('You have already reacted.')] as const;
  }

  let newCount = 0;

  if (existingReaction?.id) {
    const reaction = await prisma.messageReaction.update({
      where: { id: existingReaction.id },
      data: { reactedUsers: { create: { userId: opts.reactedByUserId } } },
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
        reactedUsers: { create: { userId: opts.reactedByUserId } },
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
              reactedUsers: { where: { userId: opts.reactionRemovedByUserId } },
            },
          },
        },
      },
    },
  });

  if (!message) return [null, generateError('Invalid messageId')] as const;

  // check if already reacted
  const existingReaction = message.reactions[0] as (typeof message.reactions)[0] | undefined;

  if (!existingReaction?._count?.reactedUsers) {
    return [null, generateError('You have already not reacted')] as const;
  }

  const reactionCount = await prisma.reactedMessageUser.count({
    where: { reactionId: existingReaction.id },
  });
  if (!reactionCount) return [null, generateError('Invalid Reaction')] as const;

  if (reactionCount === 1) {
    await prisma.messageReaction.delete({ where: { id: existingReaction.id } });
  }

  if (reactionCount > 1) {
    await prisma.reactedMessageUser.delete({
      where: { reactionId_userId: { reactionId: existingReaction.id, userId: opts.reactionRemovedByUserId } },
    });
  }

  const payload = {
    reactionRemovedByUserId: opts.reactionRemovedByUserId,
    messageId: opts.messageId,
    channelId: opts.channelId,
    emojiId: opts.emojiId,
    name: opts.name,
    count: reactionCount - 1,
    gif: existingReaction.gif,
  };

  // emit
  if (opts.serverId) {
    emitServerMessageReactionRemoved(opts.channelId, payload);
    return [message, null];
  }

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.reactionRemovedByUserId);
  }

  if (channel?.inbox?.recipientId) {
    emitDMMessageReactionRemoved(channel, payload);
  }

  return [payload, null] as const;
};

interface GetMessageReactedUsersOpts {
  messageId: string;
  name: string;
  emojiId?: string;
  limit: number;
}

export const getMessageReactedUsers = async (opts: GetMessageReactedUsersOpts) => {
  const reaction = await prisma.messageReaction.findFirst({
    where: {
      messageId: opts.messageId,
      ...addToObjectIfExists('emojiId', opts.emojiId),
      ...addToObjectIfExists('name', opts.name),
    },
    select: { id: true },
  });

  if (!reaction) return [null, generateError('Reaction does not exist.')] as const;

  const reactedUsers = await prisma.reactedMessageUser.findMany({
    where: { reactionId: reaction.id },
    take: opts.limit,
    select: { user: { select: publicUserExcludeFields }, reactedAt: true },
    orderBy: { reactedAt: 'asc' },
  });

  return [reactedUsers, null] as const;
};

async function quotableMessages(quotedMessageIds: string[], creatorId: string, bypassQuotesCheck?: boolean) {
  const messages = await prisma.message.findMany({
    where: {
      id: { in: quotedMessageIds },
      type: MessageType.CONTENT,
      ...(!bypassQuotesCheck
        ? {
          channel: {
            OR: [
              { server: { serverMembers: { some: { userId: creatorId } } } }, // is server member
              {
                inbox: {
                  // is inbox channel
                  some: {
                    OR: [{ recipientId: creatorId }, { createdById: creatorId }],
                  },
                },
              },
            ],
          },
        }
        : {}),
    },
    select: {
      id: true,
    },
  });
  return messages;
}

async function addMention(userIds: string[], serverId: string, channelId: string, requesterId: string, message: Message, channel: ChannelCache, server: ServerCache) {
  let filteredUserIds = [...userIds];
  // is private channel
  if (hasBit(channel.permissions, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit)) {
    const roles = await prisma.serverRole.findMany({
      where: { serverId },
      select: { id: true, permissions: true },
    });
    const defaultRole = roles.find((role) => role.id === server.defaultRoleId);

    const mentionedMembers = await prisma.serverMember.findMany({
      where: { serverId, userId: { in: userIds } },
      select: { roleIds: true, userId: true },
    });

    filteredUserIds = mentionedMembers
      .filter((member) => {
        if (member.userId === server.createdById) return true;
        const memberRoles = [defaultRole, ...member.roleIds.map((roleId) => roles.find((r) => r.id === roleId))];
        const permissions = memberRoles.reduce((val, role) => {
          if (!role) return val;
          return addBit(val, role?.permissions);
        }, 0);
        return hasBit(permissions, ROLE_PERMISSIONS.ADMIN.bit);
      })
      .map((member) => member.userId);
  }

  const mentionedUsers = await prisma.user.findMany({
    where: {
      id: { in: filteredUserIds, not: requesterId },
      servers: { some: { id: serverId } },
      friends: { none: { recipientId: requesterId, status: FriendStatus.BLOCKED } },
    },
    select: {
      id: true,
      notificationSettings: {
        where: {
          OR: [{ channelId }, { serverId }],
        },
        select: { channelId: true, serverId: true, notificationPingMode: true },
      },
    },
  });

  const filteredMentionedUsers = mentionedUsers.filter((user) => {
    if (!user.notificationSettings.length) return true;
    const channelNotificationMode = user.notificationSettings.find((n) => n.channelId)?.notificationPingMode;
    const serverNotificationMode = user.notificationSettings.find((n) => n.serverId)?.notificationPingMode;

    const combined = channelNotificationMode ?? serverNotificationMode;
    if (combined === null || combined === undefined) return true;
    return combined !== NotificationPingMode.MUTE;
  });

  await prisma.$transaction([
    prisma.messageNotification.createMany({
      data: filteredMentionedUsers.map((user) => ({
        id: generateId(),
        userId: user.id,
        messageId: message.id,
        serverId,
      })),
    }),
    ...filteredMentionedUsers.map((user) =>
      prisma.messageMention.upsert({
        where: {
          mentionedById_mentionedToId_channelId: {
            channelId: channelId,
            mentionedById: requesterId,
            mentionedToId: user.id,
          },
        },
        update: {
          count: { increment: 1 },
        },
        create: {
          id: generateId(),
          count: 1,
          channelId: channelId,
          mentionedById: requesterId,
          mentionedToId: user.id,
          serverId: serverId,
          createdAt: dateToDateTime(message.createdAt),
        },
      })
    ),
  ]);
}

export async function buttonClick(opts: { channelId: string; messageId: string; buttonId: string; clickedUserId: string }) {
  const button = await prisma.messageButton.findUnique({
    where: { messageId_id: { messageId: opts.messageId, id: opts.buttonId } },
    include: {
      message: { select: { channelId: true, createdById: true } },
    },
  });

  if (button?.message.channelId !== opts.channelId) {
    return [false, generateError('Button not found')] as const;
  }

  const channel = await prisma.channel.findUnique({
    where: { id: opts.channelId },
    select: { serverId: true },
  });

  if (!channel) {
    return [false, generateError('Channel not found')] as const;
  }

  if (channel.serverId) {
    const isMessageCreatorInServer = await prisma.serverMember.findUnique({
      where: {
        userId_serverId: {
          serverId: channel.serverId,
          userId: button?.message.createdById,
        },
      },
    });
    if (!isMessageCreatorInServer) {
      return [false, generateError('Button not found')] as const;
    }
  }

  emitButtonClick({
    emitToId: button.message.createdById,
    userId: opts.clickedUserId,
    messageId: opts.messageId,
    channelId: opts.channelId,
    buttonId: opts.buttonId,
  });

  return [true, null] as const;
}

interface ButtonClickCallbackOpts {
  channelId: string;
  messageId: string;
  buttonId: string;
  data: {
    userId: string;
    title?: string;
    content?: string;
  };
}

export async function buttonClickCallback(opts: ButtonClickCallbackOpts) {
  const user = await prisma.user.findUnique({
    where: { id: opts.data.userId },
  });

  if (!user) {
    return [false, generateError('User not found')] as const;
  }

  const button = await prisma.messageButton.findUnique({
    where: { messageId_id: { messageId: opts.messageId, id: opts.buttonId } },
    include: {
      message: { select: { channelId: true, createdById: true } },
    },
  });

  if (button?.message.channelId !== opts.channelId) {
    return [false, generateError('Button not found')] as const;
  }

  const channel = await prisma.channel.findUnique({
    where: { id: opts.channelId },
    select: { serverId: true },
  });

  if (!channel) {
    return [false, generateError('Channel not found')] as const;
  }

  if (channel.serverId) {
    const isMemberInServer = await prisma.serverMember.findUnique({
      where: {
        userId_serverId: {
          serverId: channel.serverId,
          userId: opts.data.userId,
        },
      },
    });
    if (!isMemberInServer) {
      return [false, generateError('Button not found')] as const;
    }
  }

  emitButtonClickCallback({
    emitToId: opts.data.userId,
    userId: button.message.createdById,
    messageId: opts.messageId,
    channelId: opts.channelId,
    buttonId: opts.buttonId,
    data: {
      ...addToObjectIfExists('title', opts.data.title),
      ...addToObjectIfExists('content', opts.data.content),
    },
  });

  return [true, null] as const;
}
