import { ChannelCache, getChannelCache } from '../cache/ChannelCache';
import { emitDMMessageCreated, emitDMMessageDeleted, emitDMMessageReactionAdded, emitDMMessageReactionRemoved, emitDMMessageUpdated } from '../emits/Channel';
import { emitServerMessageCreated, emitServerMessageDeleted, emitServerMessageReactionAdded, emitServerMessageReactionRemoved, emitServerMessageUpdated } from '../emits/Server';
import { MessageType } from '../types/Message';
import { dismissChannelNotification } from './Channel';
import { dateToDateTime, exists, getMessageReactedUserIds, prisma, publicUserExcludeFields } from '../common/database';
import { generateId } from '../common/flakeId';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import { Attachment, Message } from '@prisma/client';
import { removeDuplicates } from '../common/utils';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { deleteImage } from '../common/nerimityCDN';
import { getOGTags } from '../common/OGTags';
import { sendDmPushNotification, sendServerPushMessageNotification } from '../fcm/pushNotification';
import { ServerCache, getServerCache } from '../cache/ServerCache';
import { NotificationPingMode } from './User/User';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../common/Bitwise';
import { ChannelType } from '../types/Channel';
import { Log } from '../common/Log';

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

  const t0 = performance.now();
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
          ...(opts?.requesterId ? { reactedUsers: { where: { id: opts.requesterId } } } : undefined),
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

  const t1 = performance.now();
  if (opts?.requesterId === '1289157673362825217') Log.debug(`get messages: ${t1 - t0}ms`);

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
export const deleteRecentMessages = async (userId: string, serverId: string) => {
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

  const message = await prisma.message.update({
    where: { id: opts.messageId },
    data: await constructData(
      {
        content,
        editedAt: dateToDateTime(),
      },
      opts.userId,
      true
    ),
    include: MessageInclude,
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
  attachment?: Partial<Attachment>;
  everyoneMentioned?: boolean;
}

type MessageDataCreate = Parameters<typeof prisma.message.create>[0]['data'];
type MessageDataUpdate = Parameters<typeof prisma.message.update>[0]['data'];

const userMentionRegex = /\[@:([\d]+)]/g;
const quoteMessageRegex = /\[q:([\d]+)]/g;

function constructData(messageData: MessageDataUpdate, creatorId: string, update: true): Promise<any>;
function constructData(messageData: MessageDataCreate, creatorId: string, update?: false | undefined): Promise<any>;

async function constructData(messageData: MessageDataCreate | MessageDataUpdate, creatorId: string, update?: boolean) {
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

    const quotedMessageIds = removeDuplicates([...messageData.content.matchAll(quoteMessageRegex)].map((m) => m[1])).slice(0, 5);
    if (quotedMessageIds.length) {
      const messages = await quotableMessages(quotedMessageIds, creatorId);
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
    data: await constructData(
      {
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
                  ...opts.attachment,
                  id: generateId(),
                  channelId: opts.channelId,
                  serverId: opts.serverId,
                },
              },
            }
          : undefined),
      },
      opts.userId
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
    console.log(e);
    return [];
  });

  if (!message) {
    return [null, "Couldn't create message"] as const;
  }

  // update sender last seen
  opts.updateLastSeen !== false && (await dismissChannelNotification(opts.userId, opts.channelId, false));

  let channel = opts.channel;
  let server = opts.server;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
  }

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
    .catch(() => {});
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
    include: { attachments: true },
  });
  if (!message) return [false, 'Message not found!'] as const;

  await prisma.message.delete({ where: { id: opts.messageId } });

  if (message.attachments?.[0]?.path && message.attachments[0].provider === AttachmentProviders.Local) {
    deleteImage(message.attachments[0].path);
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
            select: { reactedUsers: { where: { id: opts.reactedByUserId } } },
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
  const existingReaction = message.reactions[0] as (typeof message.reactions)[0] | undefined;

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

  // this is done this way to get the oldest reacted users first.
  const userIds = await getMessageReactedUserIds(reaction.id);

  if (!userIds.length) return [[], null] as const;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: publicUserExcludeFields,
  });

  // sort users.id by userIds
  users.sort((a, b) => {
    return userIds.indexOf(a.id) - userIds.indexOf(b.id);
  });

  return [users, null] as const;
};

async function quotableMessages(quotedMessageIds: string[], creatorId: string) {
  const messages = await prisma.message.findMany({
    where: {
      id: { in: quotedMessageIds },
      type: MessageType.CONTENT,
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
    prisma.userNotification.createMany({
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
