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
import { htmlToJson } from '@nerimity/html-embed';
import { zip } from '@src/common/zip';
import { removeDuplicates } from '@src/common/utils';

interface EditMessageOptions {
  userId: string;
  channelId: string;
  channel?: ChannelCache | null;
  serverId?: string;
  content?: string;
  htmlEmbed?: string;
  messageId: string;
  buttons?: {
    label: string;
    id: string;
    alert?: boolean;
  }[];
}

const validateMessageOptions = async (opts: EditMessageOptions) => {
  const messageExists = await exists(prisma.message, {
    where: { id: opts.messageId, createdById: opts.userId },
  });

  if (!messageExists) {
    return [null, generateError('Message does not exist or is not created by you.')] as const;
  }

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

  let channel = opts.channel;

  if (!channel) {
    [channel] = await getChannelCache(opts.channelId, opts.userId);
  }
  const isServerOrDMChannel = channel?.type === ChannelType.DM_TEXT || channel?.type === ChannelType.SERVER_TEXT;

  const data = {
    channel,
    isServerOrDMChannel,
    htmlEmbed,
    buttons: opts.buttons,
  };

  return [data, null] as const;
};

type ValidationResult = NonNullable<Awaited<ReturnType<typeof validateMessageOptions>>[0]>;

const updateMessageInDatabase = async (opts: EditMessageOptions, validatedResult: ValidationResult) => {
  const htmlEmbed = validatedResult.htmlEmbed;
  const buttons = validatedResult.buttons;
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

  const [, message] = await prisma
    .$transaction([
      ...(buttons ? [prisma.messageButton.deleteMany({ where: { messageId: opts.messageId } })] : []),
      prisma.message.update({
        where: { id: opts.messageId },
        data: {
          content: validatedResult.isServerOrDMChannel && opts.content ? replaceBadWords(opts.content) : opts.content,
          editedAt: dateToDateTime(),
          embed: Prisma.JsonNull,
          ...(htmlEmbed ? { htmlEmbed: zip(JSON.stringify(htmlEmbed)) } : undefined),

          ...(buttons?.length
            ? {
                buttons: {
                  createMany: { data: buttons },
                },
              }
            : undefined),

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
      }),
    ])
    .catch((e) => {
      console.error(e);
      return [null, null];
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
