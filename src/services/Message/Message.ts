import { ChannelCache, getChannelCache } from '../../cache/ChannelCache';
import { emitButtonClick, emitButtonClickCallback, emitDMMessageDeleted, emitDMMessageReactionAdded, emitDMMessageReactionRemoved, emitDMMessageUpdated, emitMessageMarkUnread } from '../../emits/Channel';
import { emitServerMessageDeleted, emitServerMessageDeletedBatch, emitServerMessageReactionAdded, emitServerMessageReactionRemoved, emitServerMessageUpdated } from '../../emits/Server';
import { MessageType } from '../../types/Message';
import { dateToDateTime, prisma, publicUserExcludeFields } from '../../common/database';
import { generateId } from '../../common/flakeId';
import { generateError } from '../../common/errorHandler';
import { Message, Prisma } from '@src/generated/prisma/client';
import { isString, removeDuplicates } from '../../common/utils';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import { deleteFile } from '../../common/nerimityCDN';
import { getOGTags } from '../../common/OGTags';
import { ServerCache } from '../../cache/ServerCache';
import { NotificationPingMode } from '../User/User';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../../common/Bitwise';
import { ChannelType } from '../../types/Channel';
import { FriendStatus } from '../../types/Friend';
import { createMessageV2, SendMessageOptions } from './MessageCreate';
import { editMessageV2 } from './MessageEdit';
import { ButtonCallback } from '@src/routes/channels/channelMessageButtonClickCallback';

interface GetMessageByChannelIdOpts {
  limit?: number;
  beforeMessageId?: string;
  aroundMessageId?: string;
  afterMessageId?: string;
  requesterId?: string;
}

interface GetSingleMessageByChannelIdOpts {
  requesterId?: string;
  messageId: string;
  channelId: string;
}

export const AttachmentProviders = {
  Local: 'local', // nerimity cdn
  GoogleDrive: 'google_drive',
} as const;

type TransformMessage = Omit<PublicMessage, 'reactions'> & {
  reactions: Prisma.MessageReactionGetPayload<{
    select: {
      reactedUsers: true;
      emojiId: true;
      gif: true;
      name: true;
      _count: {
        select: {
          reactedUsers: true;
        };
      };
    };
  }>[];
};

export type TransformedMessage = ReturnType<typeof transformMessage>;

export function transformMessage(message: TransformMessage) {
  const newMessage = {
    ...message,
    createdBy: { ...message.createdBy } as typeof message.createdBy & { avatarUrl?: string },
    reactions: message.reactions.map((reaction) => ({
      ...reaction,
      reacted: !!reaction.reactedUsers?.length,
      count: reaction._count.reactedUsers,
      reactedUsers: undefined,
      _count: undefined,
    })),

    quotedMessages: message.quotedMessages.map((quote) => {
      if (quote.webhook) {
        quote.createdBy = {
          id: quote.webhookId!,
          badges: 0,
          bot: true,
          tag: '0000',
          username: quote.webhook.name,
          avatar: quote.webhook.avatar,
          hexColor: quote.webhook.hexColor,
        };
      }
      return {
        ...quote,
        webhook: undefined,
      };
    }),

    messageReplies: message.replyMessages.map((reply) => {
      if (reply.replyToMessage?.webhook) {
        reply.replyToMessage.createdBy = {
          id: reply.replyToMessage.webhookId!,
          badges: 0,
          bot: true,
          tag: '0000',
          username: reply.replyToMessage.webhook.name,
          avatar: reply.replyToMessage.webhook.avatar,
          hexColor: reply.replyToMessage.webhook.hexColor,
        };
      }

      return {
        replyToMessage: {
          ...reply.replyToMessage,
          webhook: undefined,
        },
      };
    }),

    webhook: undefined,
    creatorOverride: undefined,
  };

  if (message.webhook) {
    newMessage.createdBy = {
      id: message.webhookId!,
      badges: 0,
      bot: true,
      tag: '0000',
      username: message.webhook.name,
      avatar: message.webhook.avatar,
      hexColor: message.webhook.hexColor,
    };
  }

  if (newMessage.createdBy) {
    if (message.creatorOverrideId) {
      newMessage.createdBy.id += '-' + message.creatorOverrideId;
    }
    if (message.creatorOverride?.username) {
      newMessage.createdBy.username = message.creatorOverride.username;
    }
    if (message.creatorOverride?.avatarUrl) {
      newMessage.createdBy.avatarUrl = message.creatorOverride.avatarUrl;
    }
  }

  return newMessage;
}

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
      ...MessageInclude,

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
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    ...(opts?.afterMessageId
      ? {
          orderBy: { createdAt: 'asc' },
        }
      : undefined),
  });

  const modifiedMessages = messages.map(transformMessage);

  if (opts?.afterMessageId) return modifiedMessages;

  return modifiedMessages.reverse();
};

export const getMessageByChannelId = async (opts: GetSingleMessageByChannelIdOpts) => {
  const message = await prisma.message.findUnique({
    where: {
      id: opts.messageId,
      channelId: opts.channelId,
    },
    include: MessageInclude,
  });

  if (message?.webhook) {
    message.createdBy = {
      id: message.webhookId!,
      badges: 0,
      bot: true,
      tag: '0000',
      username: message.webhook.name,
      avatar: message.webhook.avatar,
      hexColor: message.webhook.hexColor,
    };
  }

  return message;
};

export const pinnedChannelMessages = async (channelId: string, afterId?: string) => {
  const messages = await prisma.pinnedMessage.findMany({
    where: { channelId },
    take: 10,
    orderBy: { pinnedAt: 'desc' },
    ...(afterId ? { cursor: { messageId: afterId }, skip: 1 } : {}),
    select: {
      message: {
        include: { ...MessageInclude, reactions: false },
      },
    },
  });

  const modifiedMessages = messages.map((p) => transformMessage({ ...p.message, reactions: [] }));

  return [modifiedMessages, null] as const;
};

export const pinMessage = async (opts: { messageId: string; channelId: string; channelCache: ChannelCache; serverCache?: ServerCache; userId: string }) => {
  return prisma
    .$transaction(async (tx) => {
      const message = await tx.message.findUnique({
        where: { channelId: opts.channelId, id: opts.messageId },
        select: { id: true, pinned: true, type: true },
      });
      if (!message) return [null, generateError('Message not found!')] as const;
      if (message?.pinned) {
        return [null, generateError('Message already pinned!')] as const;
      }
      if (message.type !== MessageType.CONTENT) return [null, generateError('Cannot pin a non-content message!')] as const;

      await tx.message.update({
        where: { id: opts.messageId },
        data: { pinned: true, pinnedMessage: { create: { channelId: opts.channelId } } },
      });

      createMessage({
        channel: opts.channelCache,
        server: opts.serverCache,
        type: MessageType.PINNED_MESSAGE,
        channelId: opts.channelCache.id,
        userId: opts.userId,
      });

      if (opts.serverCache?.id) {
        emitServerMessageUpdated(opts.channelId!, message.id, { pinned: true });
      } else if (opts.channelCache.type === ChannelType.DM_TEXT) {
        emitDMMessageUpdated(opts.channelCache, message.id, { pinned: true });
      }

      return [true, null] as const;
    })
    .catch((err) => {
      console.error(`Error pinning message ${opts.messageId} in channel ${opts.channelId}:`, err);
      return [null, generateError('Something went wrong, try again later.')] as const;
    });
};

export const unpinMessage = async (opts: { messageId: string; channelId: string; serverCache: ServerCache; channelCache: ChannelCache }) => {
  return prisma
    .$transaction(async (tx) => {
      const pinnedMessage = await tx.pinnedMessage.findUnique({
        where: { messageId: opts.messageId, channelId: opts.channelId },
        select: { messageId: true },
      });
      if (!pinnedMessage) return [null, generateError('Message not found!')] as const;

      await tx.message.update({
        where: { id: opts.messageId },
        data: { pinned: false, pinnedMessage: { delete: true } },
      });

      if (opts.serverCache?.id) {
        emitServerMessageUpdated(opts.channelId!, pinnedMessage.messageId, { pinned: false });
      } else if (opts.channelCache.type === ChannelType.DM_TEXT) {
        emitDMMessageUpdated(opts.channelCache, pinnedMessage.messageId, { pinned: false });
      }

      return [true, null] as const;
    })
    .catch((err) => {
      console.error(`Error unpinning message ${opts.messageId} in channel ${opts.channelId}:`, err);
      return [null, generateError('Something went wrong, try again later.')] as const;
    });
};

// delete messages sent in the last 7 hours
export const deleteRecentUserServerMessages = async (userId: string, serverId: string) => {
  const fromTime = new Date();
  const toTime = new Date();
  toTime.setHours(toTime.getHours() - 7);

  await prisma.message.deleteMany({
    where: {
      createdById: userId,
      channel: { serverId },
      createdAt: {
        gt: dateToDateTime(toTime),
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

export const MessageValidator = {
  include: {
    webhook: {
      select: {
        avatar: true,
        name: true,
        hexColor: true,
      },
    },
    creatorOverride: {
      select: {
        id: true,
        username: true,
        avatarUrl: true,
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
    mentions: {
      select: {
        id: true,
        username: true,
        tag: true,
        hexColor: true,
        badges: true,
        avatar: true,
      },
    },
    roleMentions: {
      select: {
        id: true,
        name: true,
        hexColor: true,
        icon: true,
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
      orderBy: { order: 'asc' },
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
                duration: true,
                expireAt: true,
                provider: true,
                fileId: true,
                mime: true,
                createdAt: true,
              },
            },
            webhookId: true,
            webhook: {
              select: {
                avatar: true,
                name: true,
                hexColor: true,
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
            badges: true,
            avatar: true,
          },
        },
        roleMentions: {
          select: {
            id: true,
            name: true,
            hexColor: true,
            icon: true,
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
            duration: true,
            expireAt: true,
            fileId: true,
            mime: true,
            createdAt: true,
          },
        },
        webhookId: true,
        webhook: {
          select: {
            avatar: true,
            name: true,
            hexColor: true,
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
        duration: true,
        expireAt: true,
        fileId: true,
        mime: true,
        createdAt: true,
      },
    },
    reactions: true,
  },
} satisfies { include: Prisma.MessageInclude };

export type PublicMessage = Prisma.MessageGetPayload<typeof MessageValidator>;

export const MessageInclude = MessageValidator.include;

export const editMessage = editMessageV2;

export const createMessage = createMessageV2;

const urlRegex = new RegExp('(^|[ \t\r\n])((http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))');

export const addMessageEmbed = async (message: Message, opts: { serverId?: string; channel?: ChannelCache | null }) => {
  const url = message.content?.match(urlRegex)?.[0].trim();
  if (!url) return;
  const OGTags = await getOGTags(url);
  if (!OGTags) return;
  const res = await prisma.message
    .update({
      where: { id: message.id },
      data: { embed: OGTags },
    })

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
    include: { attachments: true, _count: { select: { attachments: true } } },
  });
  if (!message) return [false, 'Message not found!'] as const;

  const deleteRes = await prisma.message.delete({ where: { id: opts.messageId } }).catch(() => {});

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

interface AddMentionOpts {
  userIds: string[];
  serverId: string;
  channelId: string;
  requesterId?: string;
  webhookId?: string;
  message: Message;
  server: ServerCache;
}

export async function addMention(opts: AddMentionOpts) {
  const { userIds, serverId, channelId, requesterId, message, server, webhookId } = opts;

  if (!webhookId && !requesterId) {
    return;
  }

  let filteredUserIds = [...userIds];

  const channelPermissions = await prisma.serverChannelPermissions.findMany({
    where: { channelId, serverId },
  });

  const defaultChannelPerms = channelPermissions.find((permission) => permission.roleId === server.defaultRoleId);
  const isPrivateChannel = !hasBit(defaultChannelPerms?.permissions || 0, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);

  if (isPrivateChannel) {
    const [roles, mentionedMembers] = await prisma.$transaction([
      prisma.serverRole.findMany({
        where: { serverId },
        select: { id: true, permissions: true },
      }),
      prisma.serverMember.findMany({
        where: { serverId, userId: { in: userIds } },
        select: { roleIds: true, userId: true },
      }),
    ]);

    const defaultRole = roles.find((role) => role.id === server.defaultRoleId);

    filteredUserIds = mentionedMembers
      .filter((member) => {
        if (member.userId === server.createdById) return true;
        const memberRoles = [defaultRole, ...member.roleIds.map((roleId) => roles.find((r) => r.id === roleId))];
        const rolePerms = memberRoles.reduce((val, role) => {
          if (!role) return val;
          return addBit(val, role?.permissions);
        }, 0);

        let channelPerms = 0;

        for (let i = 0; i < channelPermissions.length; i++) {
          const perms = channelPermissions[i]!;
          if (member.roleIds.includes(perms.roleId)) {
            channelPerms = addBit(channelPerms, perms.permissions || 0);
          }
        }

        return hasBit(rolePerms, ROLE_PERMISSIONS.ADMIN.bit) || hasBit(channelPerms, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);
      })
      .map((member) => member.userId);
  }

  const mentionedUsers = await prisma.user.findMany({
    where: {
      id: { in: filteredUserIds, not: requesterId },
      servers: { some: { id: serverId } },
      friends: { none: { recipientId: requesterId, status: FriendStatus.BLOCKED } },
      bot: null,
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
          ...(requesterId
            ? {
                mentionedById_mentionedToId_channelId: {
                  channelId: channelId,
                  mentionedById: requesterId,
                  mentionedToId: user.id,
                },
              }
            : {
                mentionedByWebhookId_mentionedToId_channelId: {
                  channelId: channelId,
                  mentionedToId: user.id,
                  mentionedByWebhookId: webhookId!,
                },
              }),
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

export async function buttonClick(opts: { channelId: string; messageId: string; buttonId: string; clickedUserId: string; data: any }) {
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

  if (!button.message.createdById) {
    return [false, generateError('Button not found')] as const;
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
    type: opts.data ? 'modal_click' : 'button_click',
    emitToId: button.message.createdById,
    userId: opts.clickedUserId,
    messageId: opts.messageId,
    channelId: opts.channelId,
    buttonId: opts.buttonId,
    data: opts.data,
  });

  return [true, null] as const;
}

interface ButtonClickCallbackOpts {
  channelId: string;
  messageId: string;
  buttonId: string;
  data: ButtonCallback;
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
  if (!button.message.createdById) {
    return [false, generateError('Invalid message')] as const;
  }

  emitButtonClickCallback({
    emitToId: opts.data.userId,
    userId: button.message.createdById,
    messageId: opts.messageId,
    channelId: opts.channelId,
    buttonId: opts.buttonId,
    data: opts.data,
  });

  return [true, null] as const;
}

export async function markMessageUnread(opts: { channelId: string; messageId: string; userId: string }) {
  const [channel, error] = await getChannelCache(opts.channelId, opts.userId);
  if (error) {
    return [false, error] as const;
  }
  const message = await prisma.message.findUnique({
    where: { id: opts.messageId, channelId: opts.channelId },
    select: {
      channelId: true,
      createdAt: true,
      channel: { select: { serverId: true } },
    },
  });
  if (!message) {
    return [false, generateError('Message not found')] as const;
  }

  if (!message.channel) {
    return [false, generateError('Channel not found')] as const;
  }

  if (message.channel.serverId) {
    await prisma.serverChannelLastSeen.upsert({
      where: {
        channelId_userId_serverId: {
          userId: opts.userId,
          serverId: message.channel.serverId,
          channelId: opts.channelId,
        },
      },
      create: {
        id: generateId(),
        userId: opts.userId,
        serverId: message.channel.serverId,
        channelId: opts.channelId,
        lastSeen: dateToDateTime((message.createdAt as unknown as number) - 1),
      },
      update: {
        lastSeen: dateToDateTime((message.createdAt as unknown as number) - 1),
      },
    });
  } else if (channel.type === ChannelType.DM_TEXT) {
    const upsertResult = await prisma.messageMention
      .upsert({
        where: {
          mentionedById_mentionedToId_channelId: {
            channelId: channel.id,
            mentionedById: channel.inbox.recipientId,
            mentionedToId: opts.userId,
          },
        },
        update: {
          count: 1,
          channelId: channel.id,
          mentionedById: channel.inbox.recipientId,
          mentionedToId: opts.userId,
          createdAt: dateToDateTime((message.createdAt as unknown as number) - 1),
        },
        create: {
          id: generateId(),
          count: 1,
          channelId: channel.id,
          mentionedById: channel.inbox.recipientId,
          mentionedToId: opts.userId,
          createdAt: dateToDateTime((message.createdAt as unknown as number) - 1),
        },
      })
      .catch(console.error);

    if (!upsertResult) {
      return [false, generateError('Something went wrong. Try again later.')] as const;
    }
  }
  emitMessageMarkUnread(opts.userId, opts.channelId, (message.createdAt as unknown as number) - 1);
  return [true, null] as const;
}

interface SearchMessageByChannelIdOpts {
  query: string;
  order?: 'asc' | 'desc';
  limit?: number;
  beforeMessageId?: string;
  afterMessageId?: string;
  requesterId?: string;
  userIds?: string[];
}

export const searchMessagesByChannelId = async (channelId: string, opts?: SearchMessageByChannelIdOpts) => {
  const limit = opts?.limit || 50;
  if (limit > 100) return [];
  if (limit <= 0) return [];

  const order = opts?.order || 'desc';

  const messages = await prisma.message.findMany({
    where: {
      ...(opts?.query.trim()
        ? {
            content: {
              mode: 'insensitive',
              contains: opts.query.trim(),
            },
          }
        : {}),
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
      ...(opts?.userIds?.length ? { createdById: { in: opts.userIds } } : undefined),
    },
    include: {
      ...MessageInclude,

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
    },
    take: limit,
    orderBy: {
      createdAt: opts?.afterMessageId ? 'asc' : order,
    },
  });

  const modifiedMessages = messages.map(transformMessage);

  if (opts?.afterMessageId) return modifiedMessages;

  if (opts?.afterMessageId || order === 'asc') {
    return modifiedMessages;
  }

  return modifiedMessages.reverse();
};
