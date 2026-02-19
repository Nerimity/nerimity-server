import { ChannelCache, getChannelForUserCache } from '../../cache/ChannelCache';
import { getServerCache, ServerCache } from '../../cache/ServerCache';
import { dateToDateTime, prisma } from '../../common/database';
import { MessageType } from '../../types/Message';
import { ChannelType } from '../../types/Channel';
import { generateError } from '../../common/errorHandler';
import { MessageInclude, TransformedMessage, transformMessage } from './Message';
import { emitServerMessageCreated } from '../../emits/Server';
import { sendDmPushNotification, sendServerPushMessageNotification } from '../../fcm/pushNotification';
import { generateId } from '../../common/flakeId';
import { emitDMMessageCreated } from '../../emits/Channel';
import { prepareMessageForDatabase } from './prepareMessageForDatabase';
import { getServerMemberCache, ServerMemberCache } from '@src/cache/ServerMemberCache';

export interface SendMessageOptions {
  userId?: string;
  channelId: string;
  channel?: ChannelCache | null;
  server?: ServerCache | null;
  member?: ServerMemberCache | null;
  serverId?: string;
  type: MessageType;
}

const validateMessageOptions = async (opts: SendMessageOptions) => {
  const messageCreatedAt = dateToDateTime();

  let channel = opts.channel;
  let server = opts.server;
  let member = opts.member;

  if (!channel) {
    [channel] = await getChannelForUserCache(opts.channelId);
    if (channel && 'server' in channel) {
      server = channel.server;
    }
  }

  const isServerChannel = channel?.type === ChannelType.SERVER_TEXT || channel?.type === ChannelType.CATEGORY;

  if (!server && opts.server?.id && isServerChannel) {
    server = await getServerCache(opts.server?.id);
    if (!server) {
      return [null, generateError('Server not found.')] as const;
    }
  }

  if (isServerChannel && !member && opts.userId) {
    const [fetchedMember] = await getServerMemberCache(server!.id, opts.userId);
    member = fetchedMember;
  }

  const data = {
    messageCreatedAt,
    server,
    channel,
    isServerChannel,
    member,
  };
  return [data, null] as const;
};

type ValidationResult = NonNullable<Awaited<ReturnType<typeof validateMessageOptions>>[0]>;

const createMessageAndChannelUpdate = async (opts: SendMessageOptions, validatedResult: ValidationResult) => {
  const { messageCreatedAt } = validatedResult;

  const processedData = await prepareMessageForDatabase({
    channelId: opts.channelId,
    creatorId: opts.userId,
    serverId: validatedResult.server?.id,
  }).catch((err) => {
    console.error(err);
    return null;
  });

  if (!processedData) {
    return [null, generateError('Something went wrong. Try again later.')] as const;
  }

  const createMessageQuery = prisma.message.create({
    data: {
      id: generateId(),
      createdById: opts.userId,
      channelId: opts.channelId,
      type: opts.type,
      createdAt: messageCreatedAt,
      content: '',
    },
    include: {
      ...MessageInclude,
      reactions: {
        include: {
          ...(opts?.userId ? { reactedUsers: { where: { userId: opts.userId } } } : undefined),
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

  // emit
  if (validatedResult.server?.id && isServerChannel) {
    emitServerMessageCreated({
      message,
      serverId: validatedResult.server.id,
      member: validatedResult.member
        ? {
            id: validatedResult.member.id,
            permissions: validatedResult.member.permissions,
            nickname: validatedResult.member.nickname,
          }
        : null,
    });
    sendServerPushMessageNotification(validatedResult.server?.id, message, channel!, server!);
  }

  if (channel?.type === ChannelType.DM_TEXT) {
    if (!channel?.inbox?.recipientId) {
      return [null, generateError('Channel not found!')] as const;
    }

    emitDMMessageCreated(channel, message);

    sendDmPushNotification(message, channel!);
  }

  return [true, null] as const;
};

export const createSystemMessage = async (opts: SendMessageOptions) => {
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
