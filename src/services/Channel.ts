import { Channel, Server } from '@prisma/client';
import { deleteServerChannelCaches, getChannelCache, updateServerChannelCache } from '../cache/ChannelCache';
import { ServerMemberCache, getServerMemberCache, getServerMembersCache } from '../cache/ServerMemberCache';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { CustomResult } from '../common/CustomResult';
import { dateToDateTime, prisma, publicUserExcludeFields } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../common/Bitwise';
import { emitServerChannelCreated, emitServerChannelDeleted, emitServerChannelUpdated } from '../emits/Channel';
import { emitNotificationDismissed } from '../emits/User';
import { ChannelType } from '../types/Channel';
import { getIO } from '../socket/socket';
import env from '../common/env';
import { getUserIdsBySocketIds } from '../cache/UserCache';
import { serverMemberHasPermission } from '../common/serverMembeHasPermission';
import { omit } from '../common/omit';

export const dismissChannelNotification = async (userId: string, channelId: string, emit = true) => {
  const [channel] = await getChannelCache(channelId, userId);
  if (!channel) return;

  const transactions: any[] = [
    prisma.messageMention.deleteMany({
      where: { mentionedToId: userId, channelId: channelId },
    }),
  ];

  if (channel.server) {
    const [serverMember] = await getServerMemberCache(channel.server.id, userId);
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

export const createServerChannel = async (opts: CreateServerChannelOpts): Promise<CustomResult<Channel, CustomError>> => {
  const channelCount = await prisma.channel.count({
    where: { serverId: opts.serverId },
  });
  if (channelCount >= env.MAX_CHANNELS_PER_SERVER) {
    return [null, generateError('You already created the maximum amount of channels for this server.')];
  }

  const channel = await prisma.channel.create({
    data: {
      id: generateId(),
      name: opts.channelName,
      serverId: opts.serverId,
      type: opts.channelType ?? ChannelType.SERVER_TEXT,
      permissions: addBit(CHANNEL_PERMISSIONS.SEND_MESSAGE.bit, CHANNEL_PERMISSIONS.JOIN_VOICE.bit),
      createdById: opts.creatorId,
      order: channelCount + 1,
    },
  });

  getIO().in(opts.serverId).socketsJoin(channel.id);

  emitServerChannelCreated(opts.serverId, channel);

  return [channel, null];
};

export const updateServerChannelPermissions = async (serverId: string, channelId: string, roleId: string, permissions: number) => {
  const channel = await prisma.channel.findUnique({ where: { id: channelId, serverId: serverId } });
  if (!channel) {
    return [null, generateError('Channel does not exist.')];
  }

  const role = await prisma.serverRole.findUnique({ where: { id: roleId, serverId } });
  if (!role) {
    return [null, generateError('Role does not exist.')];
  }

  prisma.serverChannelPermissions.upsert({
    where: {
      roleId_channelId: {
        roleId,
        channelId,
      },
    },
    update: {
      permissions,
    },
    create: {
      channelId,
      roleId,
      serverId,
    },
  });
};

export interface UpdateServerChannelOptions {
  name?: string;
  permissions?: number;
  icon?: string | null;
  slowModeSeconds?: number | null;
}

export const updateServerChannel = async (serverId: string, channelId: string, update: UpdateServerChannelOptions): Promise<CustomResult<UpdateServerChannelOptions, CustomError>> => {
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

  if (update.permissions !== undefined && channel.category) {
    const wasPrivate = hasBit(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    const isPrivate = hasBit(update.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    if (isPrivate !== wasPrivate && !isPrivate) {
      const isCategoryPrivate = hasBit(channel.category.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
      if (isCategoryPrivate) return [null, generateError('The category this channel is in is private. Un-private the category to update this permission.')];
    }
  }

  await prisma.channel.update({ where: { id: channel.id }, data: update });

  await updateServerChannelCache(channelId, {
    ...addToObjectIfExists('name', update.name),
    ...addToObjectIfExists('permissions', update.permissions),
    ...addToObjectIfExists('slowModeSeconds', update.slowModeSeconds),
  });

  if (update.permissions !== undefined) {
    const wasPrivate = hasBit(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    const isPrivate = hasBit(update.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    if (wasPrivate !== isPrivate) {
      if (channel.type === ChannelType.CATEGORY && isPrivate) await makeChannelsInCategoryPrivate(channel.id, server.id);

      await updatePrivateChannelSocketRooms({
        channelIds: [channelId],
        isPrivate,
        serverId,
      });
    }
  }

  emitServerChannelUpdated(serverId, channelId, update);

  return [update, null];
};

interface UpdatePrivateChannelSocketRoomsOpts {
  channelIds: string[];
  serverId: string;
  isPrivate: boolean;
}

export async function updateSingleMemberPrivateChannelSocketRooms(opts: UpdatePrivateChannelSocketRoomsOpts & { userId: string }) {
  if (!opts.isPrivate) {
    getIO().in(opts.userId).socketsJoin(opts.channelIds);
    return;
  }

  const roles = await prisma.serverRole.findMany({
    where: { serverId: opts.serverId },
  });

  const server = await prisma.server.findUnique({ where: { id: opts.serverId }, select: { createdById: true, defaultRoleId: true } });
  if (!server) return;

  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { serverId: opts.serverId, userId: opts.userId } },
    select: { roleIds: true, userId: true },
  });
  if (!member) return;

  const isCreator = server.createdById === member.userId;

  if (isCreator) {
    getIO().in(member.userId).socketsJoin(opts.channelIds);
    return;
  }
  const hasPermission = serverMemberHasPermission({
    permission: ROLE_PERMISSIONS.ADMIN,
    member: member,
    serverRoles: roles,
    defaultRoleId: server.defaultRoleId,
  });
  if (!hasPermission) {
    getIO().in(member.userId).socketsLeave(opts.channelIds);
    return;
  }
  getIO().in(member.userId).socketsJoin(opts.channelIds);
}

export async function updatePrivateChannelSocketRooms(opts: UpdatePrivateChannelSocketRoomsOpts) {
  if (!opts.isPrivate) {
    getIO().in(opts.serverId).socketsJoin(opts.channelIds);
    return;
  }
  const onlineMemberSockets = await getIO().in(opts.serverId).fetchSockets();
  const onlineMemberSocketIds = onlineMemberSockets.map((s) => s.id);

  const onlineUserIds = await getUserIdsBySocketIds(onlineMemberSocketIds);

  const roles = await prisma.serverRole.findMany({
    where: { serverId: opts.serverId },
  });

  const server = await prisma.server.findUnique({ where: { id: opts.serverId }, select: { createdById: true, defaultRoleId: true } });
  if (!server) return;

  const members = await prisma.serverMember.findMany({
    where: { serverId: opts.serverId, userId: { in: onlineUserIds.filter((id) => id) as string[] } },
    select: { roleIds: true, userId: true },
  });

  for (let i = 0; i < members.length; i++) {
    const member = members[i]!;
    if (!member) continue;

    const isCreator = server.createdById === member.userId;

    if (isCreator) {
      getIO().in(member.userId).socketsJoin(opts.channelIds);
      continue;
    }
    const hasPermission = serverMemberHasPermission({
      permission: ROLE_PERMISSIONS.ADMIN,
      member: member,
      serverRoles: roles,
      defaultRoleId: server.defaultRoleId,
    });
    if (!hasPermission) {
      getIO().in(member.userId).socketsLeave(opts.channelIds);
      continue;
    }
    getIO().in(member.userId).socketsJoin(opts.channelIds);
  }
}

export const makeChannelsInCategoryPrivate = async (categoryId: string, serverId: string) => {
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
          permissions: addBit(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit),
        },
      })
    )
  );

  const categoryChannelIds = categoryChannels.map((c) => c.id);
  await deleteServerChannelCaches(categoryChannelIds);

  await updatePrivateChannelSocketRooms({
    channelIds: categoryChannelIds,
    serverId,
    isPrivate: true,
  });
};

export const deleteServerChannel = async (serverId: string, channelId: string): Promise<CustomResult<string, CustomError>> => {
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

export const upsertChannelNotice = async (content: string, where: { channelId?: string; userId?: string }) => {
  if (where.channelId && where.userId) {
    return [null, generateError('Only one of channelId and userId can be provided.' as const)] as const;
  }

  if (!where.channelId && !where.userId) {
    return [null, generateError('Either channelId or userId must be provided.' as const)] as const;
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

export const deleteChannelNotice = async (where: { channelId?: string; userId?: string }) => {
  if (where.channelId && where.userId) {
    return [null, generateError('Only one of channelId and userId can be provided.' as const)] as const;
  }

  if (!where.channelId && !where.userId) {
    return [null, generateError('Either channelId or userId must be provided.' as const)] as const;
  }

  const res = await prisma.chatNotice
    .delete({
      where: where as { userId: string } | { channelId: string },
      select: { id: true },
    })
    .catch(() => {});
  if (!res) return [null, generateError('Channel notice does not exist.' as const)] as const;
  return [true, null] as const;
};

export const getChannelNotice = async (where: { channelId?: string; userId?: string }) => {
  if (where.channelId && where.userId) {
    return [null, generateError('Only one of channelId and userId can be provided.' as const)] as const;
  }

  if (!where.channelId && !where.userId) {
    return [null, generateError('Either channelId or userId must be provided.' as const)] as const;
  }

  const res = await prisma.chatNotice
    .findUnique({
      where: where as { userId: string } | { channelId: string },
      select: { content: true, updatedAt: true, channelId: true, userId: true },
    })
    .catch(() => {});
  if (!res) return [null, generateError('Channel notice does not exist.' as const)] as const;
  return [res, null] as const;
};

export const getChannel = async (channelId: string, requesterId: string) => {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  const isChannelBeingDeleted = channel?.deleting;

  if (!channel || isChannelBeingDeleted) {
    return [null, generateError('Channel does not exist.')];
  }
  const channelWithoutDeleting = omit(channel, 'deleting');

  return [channelWithoutDeleting, null] as const;
};
