import { Channel, Server } from '@prisma/client';
import {
  deleteServerChannelCaches,
  getChannelCache,
  updateServerChannelCache,
} from '../cache/ChannelCache';
import {
  ServerMemberCache,
  getServerMemberCache,
  getServerMembersCache,
} from '../cache/ServerMemberCache';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { CustomResult } from '../common/CustomResult';
import {
  dateToDateTime,
  prisma,
  publicUserExcludeFields,
} from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, addBit, hasBit } from '../common/Bitwise';
import {
  emitServerChannelCreated,
  emitServerChannelDeleted,
  emitServerChannelUpdated,
} from '../emits/Channel';
import { emitNotificationDismissed } from '../emits/User';
import { ChannelType } from '../types/Channel';
import { getIO } from '../socket/socket';
import env from '../common/env';

export const dismissChannelNotification = async (
  userId: string,
  channelId: string,
  emit = true
) => {
  const [channel] = await getChannelCache(channelId, userId);
  if (!channel) return;

  const transactions: any[] = [
    prisma.messageMention.deleteMany({
      where: { mentionedToId: userId, channelId: channelId },
    }),
  ];

  if (channel.server) {
    const [serverMember] = await getServerMemberCache(
      channel.server.id,
      userId
    );
    if (!serverMember) return;
    const serverId = channel.server.id;

    transactions.push(
      prisma.serverChannelLastSeen.upsert({
        where: {
          channelId_userId_serverId: {
            userId,
            serverId,
            channelId,
          },
        },
        create: {
          id: generateId(),
          userId,
          serverId,
          channelId,
          lastSeen: dateToDateTime(),
        },
        update: {
          lastSeen: dateToDateTime(),
        },
      })
    );
  }
  if (!channel.server) {
    transactions.push(
      prisma.inbox.update({
        where: {
          createdById_channelId: {
            channelId,
            createdById: userId,
          },
        },
        data: { lastSeen: dateToDateTime() },
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await prisma.$transaction(transactions).catch(() => {});

  emit && emitNotificationDismissed(userId, channelId);
};

export const getAllMessageMentions = async (userId: string) => {
  const mentions = await prisma.messageMention.findMany({
    where: {
      mentionedToId: userId,
      channel: { deleting: null },
    },
    select: {
      mentionedById: true,
      mentionedBy: { select: publicUserExcludeFields },
      createdAt: true,
      channelId: true,
      serverId: true,
      count: true,
    },
  });
  return mentions;
};

export const getLastSeenServerChannelIdsByUserId = async (userId: string) => {
  const results = await prisma.serverChannelLastSeen.findMany({
    where: { userId, channel: { deleting: null } },
    select: {
      channelId: true,
      lastSeen: true,
    },
  });

  const lastSeenChannels: Record<string, Date> = {};

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    lastSeenChannels[result.channelId] = result.lastSeen;
  }
  return lastSeenChannels;
};

interface CreateServerChannelOpts {
  serverId: string;
  channelName: string;
  creatorId: string;
  channelType?: ChannelType;
}

export const createServerChannel = async (
  opts: CreateServerChannelOpts
): Promise<CustomResult<Channel, CustomError>> => {
  const channelCount = await prisma.channel.count({
    where: { serverId: opts.serverId },
  });
  if (channelCount >= env.MAX_CHANNELS_PER_SERVER) {
    return [
      null,
      generateError(
        'You already created the maximum amount of channels for this server.'
      ),
    ];
  }

  const channel = await prisma.channel.create({
    data: {
      id: generateId(),
      name: opts.channelName,
      serverId: opts.serverId,
      type: opts.channelType ?? ChannelType.SERVER_TEXT,
      permissions: addBit(
        CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
        CHANNEL_PERMISSIONS.JOIN_VOICE.bit
      ),
      createdById: opts.creatorId,
      order: channelCount + 1,
    },
  });

  getIO().in(opts.serverId).socketsJoin(channel.id);

  emitServerChannelCreated(opts.serverId, channel);

  return [channel, null];
};

export interface UpdateServerChannelOptions {
  name?: string;
  permissions?: number;
  icon?: string | null;
}

export const updateServerChannel = async (
  serverId: string,
  channelId: string,
  update: UpdateServerChannelOptions
): Promise<CustomResult<UpdateServerChannelOptions, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const channel = await prisma.channel.findFirst({
    where: { id: channelId, serverId: serverId, deleting: null },
    include: { category: { select: { permissions: true } } },
  });
  if (!channel) {
    return [null, generateError('Channel does not exist.')];
  }

  if (update.permissions && channel.category) {
    const wasPrivate = hasBit(
      channel.permissions || 0,
      CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
    );
    const isPrivate = hasBit(
      update.permissions || 0,
      CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
    );
    if (isPrivate !== wasPrivate && !isPrivate) {
      const isCategoryPrivate = hasBit(
        channel.category.permissions || 0,
        CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
      );
      if (isCategoryPrivate)
        return [
          null,
          generateError(
            'The category this channel is in is private. Un-private the category to update this permission.'
          ),
        ];
    }
  }

  await prisma.channel.update({ where: { id: channel.id }, data: update });

  await updateServerChannelCache(channelId, {
    ...addToObjectIfExists('name', update.name),
    ...addToObjectIfExists('permissions', update.permissions),
  });

  if (update.permissions !== undefined) {
    const wasPrivate = hasBit(
      channel.permissions || 0,
      CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
    );
    const isPrivate = hasBit(
      update.permissions || 0,
      CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
    );
    if (wasPrivate !== isPrivate) {
      const serverMembers = await getServerMembersCache(serverId);

      if (channel.type === ChannelType.CATEGORY && isPrivate)
        await makeChannelsInCategoryPrivate(
          channel.id,
          server.id,
          server,
          serverMembers
        );

      getIO().in(serverId).socketsLeave(channelId);

      for (let i = 0; i < serverMembers.length; i++) {
        const member = serverMembers[i];
        const isAdmin = server.createdById === member.userId;
        if (isPrivate && !isAdmin) continue;
        getIO().in(member.userId).socketsJoin(channelId);
      }
    }
  }

  emitServerChannelUpdated(serverId, channelId, update);

  return [update, null];
};

export const makeChannelsInCategoryPrivate = async (
  categoryId: string,
  serverId: string,
  server?: Server,
  serverMembers?: ServerMemberCache[]
) => {
  const category = await prisma.channel.findFirst({
    where: { id: categoryId, deleting: null },
    select: { categories: { select: { id: true, permissions: true } } },
  });

  const categoryChannels = category?.categories;
  if (!categoryChannels?.length) return;

  await prisma.$transaction(
    categoryChannels?.map((channel) =>
      prisma.channel.update({
        where: { id: channel.id },
        data: {
          permissions: addBit(
            channel.permissions || 0,
            CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
          ),
        },
      })
    )
  );

  const categoryChannelIds = categoryChannels.map((c) => c.id);
  await deleteServerChannelCaches(categoryChannelIds);

  let broadcastOperator = getIO().in(serverId);

  if (!serverMembers) {
    serverMembers = await getServerMembersCache(serverId);
  }
  if (!server) {
    server = (await prisma.server.findFirst({
      where: { id: serverId },
    })) as Server;
  }

  for (let i = 0; i < serverMembers.length; i++) {
    const member = serverMembers[i];
    const isAdmin = server.createdById === member.userId;
    if (isAdmin) broadcastOperator = broadcastOperator.except(member.userId);
  }

  broadcastOperator.socketsLeave(categoryChannelIds);
};

export const deleteServerChannel = async (
  serverId: string,
  channelId: string
): Promise<CustomResult<string, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if channel is default channel
  if (server.defaultChannelId === channelId) {
    return [null, generateError('You cannot delete the default channel.')];
  }

  // Delete the channel
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, serverId: serverId, deleting: null },
  });
  if (!channel) {
    return [null, generateError('Channel does not exist.')];
  }

  await prisma.$transaction([
    prisma.channel.update({
      where: { id: channelId },
      data: { deleting: true },
    }),
    prisma.scheduleMessageDelete.upsert({
      where: { channelId },
      create: { channelId },
      update: {},
    }),
    ...(server.systemChannelId === channel.id
      ? [
          prisma.server.update({
            where: { id: server.id },
            data: { systemChannelId: null },
          }),
        ]
      : []),
  ]);
  deleteServerChannelCaches([channelId]);

  getIO().in(serverId).socketsLeave(channelId);

  emitServerChannelDeleted(serverId, channelId);

  return [channelId, null];
};

export const upsertChannelNotice = async (
  content: string,
  where: { channelId?: string; userId?: string }
) => {
  if (where.channelId && where.userId) {
    return [
      null,
      generateError(
        'Only one of channelId and userId can be provided.' as const
      ),
    ] as const;
  }

  if (!where.channelId && !where.userId) {
    return [
      null,
      generateError('Either channelId or userId must be provided.' as const),
    ] as const;
  }

  const notice = await prisma.chatNotice.upsert({
    where: where as { userId: string } | { channelId: string },
    create: {
      id: generateId(),
      ...(where as { userId: string } | { channelId: string }),
      content,
    },
    update: { content },
  });

  return [notice, null] as const;
};

export const deleteChannelNotice = async (where: {
  channelId?: string;
  userId?: string;
}) => {
  if (where.channelId && where.userId) {
    return [
      null,
      generateError(
        'Only one of channelId and userId can be provided.' as const
      ),
    ] as const;
  }

  if (!where.channelId && !where.userId) {
    return [
      null,
      generateError('Either channelId or userId must be provided.' as const),
    ] as const;
  }

  const res = await prisma.chatNotice
    .delete({
      where: where as { userId: string } | { channelId: string },
      select: { id: true },
    })
    .catch(() => {});
  if (!res)
    return [
      null,
      generateError('Channel notice does not exist.' as const),
    ] as const;
  return [true, null] as const;
};

export const getChannelNotice = async (where: {
  channelId?: string;
  userId?: string;
}) => {
  if (where.channelId && where.userId) {
    return [
      null,
      generateError(
        'Only one of channelId and userId can be provided.' as const
      ),
    ] as const;
  }

  if (!where.channelId && !where.userId) {
    return [
      null,
      generateError('Either channelId or userId must be provided.' as const),
    ] as const;
  }

  const res = await prisma.chatNotice
    .findUnique({
      where: where as { userId: string } | { channelId: string },
      select: { content: true, updatedAt: true, channelId: true, userId: true },
    })
    .catch(() => {});
  if (!res)
    return [
      null,
      generateError('Channel notice does not exist.' as const),
    ] as const;
  return [res, null] as const;
};
