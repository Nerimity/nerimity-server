import { Attachment } from '@src/generated/prisma/client';
import { ChannelCache, getChannelCache } from '../../cache/ChannelCache';
import { getServerCache, ServerCache } from '../../cache/ServerCache';
import { dateToDateTime, prisma } from '../../common/database';
import { MessageType } from '../../types/Message';
import { ChannelType } from '../../types/Channel';
import { htmlToJson } from '@nerimity/html-embed';
import { generateError } from '../../common/errorHandler';
import { getHourStart, isString, removeDuplicates } from '../../common/utils';
import { dismissChannelNotification } from '../Channel';
import { addMention, addMessageEmbed, MessageInclude, TransformedMessage, transformMessage } from './Message';
import { emitServerMessageCreated } from '../../emits/Server';
import { sendDmPushNotification, sendServerPushMessageNotification } from '../../fcm/pushNotification';
import { generateId } from '../../common/flakeId';
import { emitDMMessageCreated } from '../../emits/Channel';
import { replaceBadWords } from '../../common/badWords';
import { zip } from '../../common/zip';
import { prepareMessageForDatabase } from './prepareMessageForDatabase';
import { validationResult } from 'express-validator';

export interface SendMessageOptions {
  userId?: string;
  webhookId?: string;
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
  canMentionRoles?: boolean;
  htmlEmbed?: string;

  replyToMessageIds?: string[];
  mentionReplies?: boolean;
  silent?: boolean;

  buttons?: {
    label: string;
    id: string;
    alert?: boolean;
  }[];

  username_override?: string;
  avatar_url_override?: string;
}

const validateMessageOptions = async (opts: SendMessageOptions) => {
  const messageCreatedAt = dateToDateTime();

  let channel = opts.channel;
  let server = opts.server;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
    if (channel && 'server' in channel) {
      server = channel.server;
    }
  }

  const isServerTextOrDMTextChannel = opts.webhookId ? true : channel?.type === ChannelType.DM_TEXT || channel?.type === ChannelType.SERVER_TEXT;
  const isServerChannel = opts.webhookId ? true : channel?.type === ChannelType.SERVER_TEXT || channel?.type === ChannelType.CATEGORY;

  let htmlEmbed = undefined;
  if (opts.htmlEmbed) {
    try {
      htmlEmbed = htmlToJson(opts.htmlEmbed);
    } catch (err: any) {
      return [null, generateError(err.message, 'htmlEmbed')] as const;
    }
  }

  if (opts.buttons) {
    const ids = opts.buttons.map((b) => b.id);
    const uniqueButtons = removeDuplicates(ids);
    if (uniqueButtons.length !== ids.length) {
      return [null, generateError('Button IDs must be unique', 'buttons')] as const;
    }
  }

  if (!server && opts.server?.id && isServerChannel) {
    server = await getServerCache(opts.server?.id);
    if (!server) {
      return [null, generateError('Server not found.')] as const;
    }
  }

  const data = {
    messageCreatedAt,
    server,
    channel,
    isServerChannel,
    isServerTextOrDMTextChannel,
    htmlEmbed,
  };
  return [data, null] as const;
};

type ValidationResult = NonNullable<Awaited<ReturnType<typeof validateMessageOptions>>[0]>;

const createMessageAndChannelUpdate = async (opts: SendMessageOptions, validatedResult: ValidationResult) => {
  const { isServerTextOrDMTextChannel, htmlEmbed, messageCreatedAt } = validatedResult;

  const processedData = await prepareMessageForDatabase({
    channelId: opts.channelId,
    creatorId: opts.userId,
    content: opts.content,
    canMentionRoles: opts.canMentionRoles,
    replyToMessageIds: opts.replyToMessageIds,
    serverId: validatedResult.server?.id,
  }).catch((err) => {
    console.error(err);
    return null;
  });

  if (!processedData) {
    return [null, generateError('Something went wrong. Try again later.')] as const;
  }

  const shouldOverride = opts.username_override?.trim() || opts.avatar_url_override?.trim();
  let overrideId: number | undefined;

  if (shouldOverride) {
    const username = opts.username_override?.trim() || null;
    const avatarUrl = opts.avatar_url_override?.trim() || null;
    let override = await prisma.messageCreatorOverride.findFirst({
      where: { username, avatarUrl },
      select: { id: true },
    });
    if (!override) {
      override = await prisma.messageCreatorOverride.create({
        data: { username, avatarUrl },
        select: { id: true },
      });
    }
    overrideId = override.id;
  }

  const createMessageQuery = prisma.message.create({
    data: {
      silent: opts.silent,
      id: generateId(),
      content: isServerTextOrDMTextChannel && opts.content ? replaceBadWords(opts.content) : opts.content || '',
      createdById: opts.userId,
      webhookId: opts.webhookId,
      channelId: opts.channelId,
      type: opts.type,
      createdAt: messageCreatedAt,
      ...(overrideId !== undefined && { creatorOverrideId: overrideId }),

      ...(processedData.userMentions.length && {
        mentions: {
          connect: processedData.userMentions,
        },
      }),

      ...(processedData.roleMentions.length && {
        roleMentions: {
          connect: processedData.roleMentions,
        },
      }),

      ...(processedData.quotes.length && {
        quotedMessages: {
          connect: processedData.quotes,
        },
      }),

      ...(processedData.replies.length && {
        mentionReplies: opts.mentionReplies,
        replyMessages: {
          createMany: {
            data: processedData.replies,
          },
        },
      }),

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
                serverId: validatedResult.server?.id,
              },
            },
          }
        : undefined),
    },
    include: {
      ...MessageInclude,
      reactions: {
        select: {
          ...(opts?.userId ? { reactedUsers: { where: { userId: opts.userId } } } : undefined),
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
    return [null, generateError("Couldn't create message")] as const;
  }

  const transformedMessage = transformMessage(message);

  return [transformedMessage, null] as const;
};

const handleMessageSideEffects = async (message: TransformedMessage, opts: SendMessageOptions, validatedResult: ValidationResult) => {
  const { channel, server, isServerChannel } = validatedResult;
  // update sender last seen
  if (opts.userId && opts.updateLastSeen !== false) {
    await dismissChannelNotification(opts.userId, opts.channelId, false);
  }

  if (validatedResult.server?.id && isServerChannel) {
    let mentionUserIds: string[] = [];

    if (opts.everyoneMentioned) {
      const serverMembers = await prisma.serverMember.findMany({
        where: { serverId: validatedResult.server?.id, NOT: { userId: opts.userId } },
        select: { userId: true },
      });
      mentionUserIds = serverMembers.map((member) => member.userId);
    } else {
      if (message.mentions.length) {
        mentionUserIds = message.mentions.map((mention) => mention.id);
      }

      if (message.mentionReplies) {
        const userIds = message.replyMessages.map((message) => message.replyToMessage?.createdBy?.id).filter(isString);
        if (userIds.length) {
          mentionUserIds = [...mentionUserIds, ...userIds];
        }
      }

      if (message.roleMentions.length) {
        const users = await prisma.user.findMany({
          where: {
            memberInServers: {
              some: {
                serverId: validatedResult.server?.id,
                roleIds: { hasSome: message.roleMentions.map((role) => role.id) },
              },
            },
          },
        });
        const userIds = users.map((user) => user.id);
        mentionUserIds = [...mentionUserIds, ...userIds];
      }

      if (message.quotedMessages.length) {
        const userIds = message.quotedMessages.map((message) => message.createdBy?.id).filter(isString);
        mentionUserIds = [...mentionUserIds, ...userIds];
      }
    }

    if (mentionUserIds.length) {
      await addMention({
        userIds: removeDuplicates(mentionUserIds),
        serverId: validatedResult.server?.id,
        channelId: opts.channelId,
        requesterId: opts.userId,
        message,
        server: server!,
      });
    }
  }

  // emit
  if (validatedResult.server?.id && isServerChannel) {
    emitServerMessageCreated(message, opts.socketId);
    sendServerPushMessageNotification(validatedResult.server?.id, message, channel!, server!);
  }

  if (channel?.type === ChannelType.DM_TEXT) {
    if (!channel?.inbox?.recipientId) {
      return [null, generateError('Channel not found!')] as const;
    }

    // For DM channels, mentions are notifications for everything.
    // For Server channels, mentions are notifications for @mentions.
    // Don't send notifications for saved notes
    const isSavedNotes = channel.inbox.recipientId === channel.inbox.createdById;
    const isMessagingBot = channel.inbox?.recipient.bot;
    if (channel?.type === ChannelType.DM_TEXT && !isSavedNotes && !isMessagingBot) {
      const upsertResult = await prisma.messageMention
        .upsert({
          where: {
            ...(opts.userId
              ? {
                  mentionedById_mentionedToId_channelId: {
                    channelId: channel.id,
                    mentionedById: opts.userId,
                    mentionedToId: channel.inbox.recipientId,
                  },
                }
              : {
                  mentionedByWebhookId_mentionedToId_channelId: {
                    channelId: channel.id,
                    mentionedToId: channel.inbox.recipientId,
                    mentionedByWebhookId: opts.webhookId!,
                  },
                }),
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
        return [null, generateError("Couldn't create message mention")] as const;
      }
    }

    emitDMMessageCreated(channel, message, opts.socketId);

    sendDmPushNotification(message, channel!);
  }

  if (message.type === MessageType.CONTENT) {
    addMessageEmbed(message, { channel, serverId: validatedResult.server?.id });
  }

  if (validatedResult.server) {
    incrementMessageCount(validatedResult.server.id);
  }

  return [true, null] as const;
};

export const createMessageV2 = async (opts: SendMessageOptions) => {
  const [validationResult, validationError] = await validateMessageOptions(opts);

  if (validationError) {
    return [null, validationError] as const;
  }

  const [message, createMessageError] = await createMessageAndChannelUpdate(opts, validationResult);

  if (createMessageError) {
    return [null, createMessageError] as const;
  }

  handleMessageSideEffects(message, opts, validationResult).then(([, error]) => {
    if (error) console.error(error.message);
  });

  return [message, null] as const;
};

async function incrementMessageCount(serverId: string): Promise<void> {
  // Determine the correct hour bucket (e.g., 10:00:00 AM)
  const hourStart = getHourStart();

  try {
    await prisma.serverHourlyMessageCount.upsert({
      where: {
        serverId_hourStart: {
          serverId: serverId,
          hourStart: hourStart,
        },
      },
      update: {
        messageCount: { increment: 1 },
      },
      create: {
        serverId: serverId,
        hourStart: hourStart,
        messageCount: 1,
      },
    });
  } catch (error) {
    console.error(`Error during Prisma count increment for server ${serverId}:`, error);
  }
}
