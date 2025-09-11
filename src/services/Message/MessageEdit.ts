import { Message, Prisma } from '@src/generated/prisma/client';
import { ChannelCache, getChannelCache } from '../../cache/ChannelCache';
import { generateError } from '../../common/errorHandler';
import { dateToDateTime, exists, prisma } from '../../common/database';
import { ChannelType } from '../../types/Channel';
import { addMessageEmbed, MessageInclude } from './Message';
import { replaceBadWords } from '../../common/badWords';
import { emitServerMessageUpdated } from '../../emits/Server';
import { emitDMMessageUpdated } from '../../emits/Channel';
import { MessageType } from '../../types/Message';
import { prepareMessageForDatabase } from './prepareMessageForDatabase';

interface EditMessageOptions {
  userId: string;
  channelId: string;
  channel?: ChannelCache | null;
  serverId?: string;
  content: string;
  messageId: string;
}

const validateMessageOptions = async (opts: EditMessageOptions) => {
  const messageExists = await exists(prisma.message, {
    where: { id: opts.messageId, createdById: opts.userId },
  });

  if (!messageExists) {
    return [null, generateError('Message does not exist or is not created by you.')] as const;
  }

  const content = opts.content.trim();

  if (!content) {
    return [null, generateError('Content is required', 'content')] as const;
  }

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
  }
  const isServerOrDMChannel = channel?.type === ChannelType.DM_TEXT || channel?.type === ChannelType.SERVER_TEXT;

  const data = {
    channel,
    isServerOrDMChannel,
  };

  return [data, null] as const;
};

type ValidationResult = NonNullable<Awaited<ReturnType<typeof validateMessageOptions>>[0]>;

const updateMessageInDatabase = async (opts: EditMessageOptions, validatedResult: ValidationResult) => {
  const processedData = await prepareMessageForDatabase({
    channelId: opts.channelId,
    creatorId: opts.userId,
    content: opts.content,
    serverId: opts.serverId,
  }).catch((err) => {
    console.error(err);
    return null;
  });

  if (!processedData) {
    return [null, generateError('Something went wrong. Try again later.')] as const;
  }

  const message = await prisma.message
    .update({
      where: { id: opts.messageId },
      data: {
        content: validatedResult.isServerOrDMChannel ? replaceBadWords(opts.content) : opts.content,
        editedAt: dateToDateTime(),
        embed: Prisma.JsonNull,

        ...(processedData.userMentions.length && {
          mentions: {
            set: processedData.userMentions,
          },
        }),

        ...(processedData.roleMentions.length && {
          roleMentions: {
            set: processedData.roleMentions,
          },
        }),

        ...(processedData.quotes.length && {
          quotedMessages: {
            set: processedData.quotes,
          },
        }),
      },

      include: { ...MessageInclude, reactions: false },
    })
    .catch((e) => {
      console.error(e);
      return null;
    });

  if (!message) {
    return [null, generateError('Failed to update message')] as const;
  }

  return [message, null] as const;
};

const handleMessageSideEffects = (message: Message, opts: EditMessageOptions, validatedResult: ValidationResult) => {
  const { channel } = validatedResult;
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
};

export const editMessageV2 = async (opts: EditMessageOptions) => {
  const [validationResult, validationError] = await validateMessageOptions(opts);

  if (validationError) {
    return [null, validationError] as const;
  }

  const [message, updateMessageError] = await updateMessageInDatabase(opts, validationResult);

  if (updateMessageError) {
    return [null, updateMessageError] as const;
  }

  handleMessageSideEffects(message, opts, validationResult);
  return [message, null];
};
