import { Channel, Server } from '@prisma/client';
import { deleteServerChannelCaches, getChannelCache, removeServerMemberPermissionsCache, updateServerChannelCache } from '../cache/ChannelCache';
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
import { Interface } from 'readline';
import { emitServerChannelPermissionsUpdated } from '../emits/Server';

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

  const server = await prisma.server.findUnique({ where: { id: opts.serverId }, select: { defaultRoleId: true } });
  if (!server?.defaultRoleId) {
    return [null, generateError('Something went wrong. Please try again! (default role not found)')];
  }
  const channel = await prisma.channel.create({
    data: {
      id: generateId(),
      name: opts.channelName,
      serverId: opts.serverId,
      type: opts.channelType ?? ChannelType.SERVER_TEXT,

      permissions: {
        create: {
          serverId: opts.serverId,
          roleId: server.defaultRoleId,
          permissions: addBit(CHANNEL_PERMISSIONS.SEND_MESSAGE.bit, addBit(CHANNEL_PERMISSIONS.JOIN_VOICE.bit, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit)),
        },
      },
      createdById: opts.creatorId,
      order: channelCount + 1,
    },
    include: {
      permissions: {
        select: {
          roleId: true,
          permissions: true,
        },
      },
    },
  });

  getIO().in(opts.serverId).socketsJoin(channel.id);

  emitServerChannelCreated(opts.serverId, channel);

  return [channel, null];
};

interface UpdateServerChannelPermissionsOpts {
  serverId: string;
  channelId: string;
  roleId: string;
  permissions: number;
}

export const updateServerChannelPermissions = async (opts: UpdateServerChannelPermissionsOpts) => {
  const channel = await prisma.channel.findUnique({ where: { id: opts.channelId, serverId: opts.serverId }, select: { id: true, permissions: true } });
  if (!channel) {
    return [null, generateError('Channel does not exist.')] as const;
  }

  const role = await prisma.serverRole.findUnique({ where: { id: opts.roleId, serverId: opts.serverId } });
  if (!role) {
    return [null, generateError('Role does not exist.')] as const;
  }

  const updated = await prisma.serverChannelPermissions.upsert({
    where: {
      roleId_channelId: {
        roleId: opts.roleId,
        channelId: opts.channelId,
      },
    },
    update: {
      permissions: opts.permissions,
    },
    create: {
      channelId: opts.channelId,
      roleId: opts.roleId,
      serverId: opts.serverId,
      permissions: opts.permissions,
    },
    select: {
      permissions: true,
      roleId: true,
      serverId: true,
      channelId: true,
    },
  });
  await removeServerMemberPermissionsCache([opts.channelId]);

  channel.permissions = channel.permissions.map((p) => (p.roleId === opts.roleId ? { ...p, permissions: opts.permissions } : p));

  await updatePrivateChannelSocketRooms({
    channels: [channel],
    serverId: opts.serverId,
  });

  emitServerChannelPermissionsUpdated(opts.serverId, updated);

  return [updated, null] as const;
};

export interface UpdateServerChannelOptions {
  name?: string;
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

  await prisma.channel.update({ where: { id: channel.id }, data: update });

  await updateServerChannelCache(channelId, {
    ...addToObjectIfExists('name', update.name),
    ...addToObjectIfExists('slowModeSeconds', update.slowModeSeconds),
  });

  emitServerChannelUpdated(serverId, channelId, update);

  return [update, null];
};

interface UpdatePrivateChannelSocketRoomsOpts {
  channels: { permissions: { permissions: number | null; roleId: string }[]; id: string }[];
  serverId: string;
}

export async function updateSingleMemberPrivateChannelSocketRooms(opts: UpdatePrivateChannelSocketRoomsOpts & { userId: string }) {
  const channelIds = opts.channels.map((c) => c.id);
  if (!channelIds.length) return;

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
    getIO().in(member.userId).socketsJoin(channelIds);
    return;
  }

  const hasAdminPermission = serverMemberHasPermission({
    permission: ROLE_PERMISSIONS.ADMIN,
    member: member,
    serverRoles: roles,
    defaultRoleId: server.defaultRoleId,
  });
  if (hasAdminPermission) {
    getIO().in(member.userId).socketsJoin(channelIds);
    return;
  }
  getIO().in(member.userId).socketsLeave(channelIds);

  const roleIds = member.roleIds.filter((id) => id);
  roleIds.push(server.defaultRoleId);

  const allowChannelIds: string[] = [];
  for (let c = 0; c < opts.channels.length; c++) {
    let permissions = 0;
    const channel = opts.channels[c]!;

    for (let y = 0; y < channel.permissions.length; y++) {
      const channelPermissions = channel.permissions[y]!;
      if (roleIds.includes(channelPermissions.roleId)) {
        permissions = addBit(permissions, channelPermissions.permissions || 0);
      }
    }

    const isPublicChannel = hasBit(permissions, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);

    if (isPublicChannel) {
      allowChannelIds.push(channel.id);
    }
  }
  if (!allowChannelIds.length) return;
  getIO().in(member.userId).socketsJoin(allowChannelIds);
}

export async function updatePrivateChannelSocketRooms(opts: UpdatePrivateChannelSocketRoomsOpts) {
  const channelIds = opts.channels.map((c) => c.id);
  if (!channelIds.length) return;
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
      getIO().in(member.userId).socketsJoin(channelIds);
      continue;
    }

    const hasAdminPermission = serverMemberHasPermission({
      permission: ROLE_PERMISSIONS.ADMIN,
      member: member,
      serverRoles: roles,
      defaultRoleId: server.defaultRoleId,
    });
    if (hasAdminPermission) {
      getIO().in(member.userId).socketsJoin(channelIds);
      continue;
    }
    getIO().in(member.userId).socketsLeave(channelIds);

    const roleIds = member.roleIds.filter((id) => id);
    roleIds.push(server.defaultRoleId);

    const allowChannelIds: string[] = [];
    for (let c = 0; c < opts.channels.length; c++) {
      let permissions = 0;
      const channel = opts.channels[c]!;

      for (let y = 0; y < channel.permissions.length; y++) {
        const channelPermissions = channel.permissions[y]!;
        if (roleIds.includes(channelPermissions.roleId)) {
          permissions = addBit(permissions, channelPermissions.permissions || 0);
        }
      }

      const isPublicChannel = hasBit(permissions, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit);

      if (isPublicChannel) {
        allowChannelIds.push(channel.id);
      }
    }
    if (!allowChannelIds.length) continue;
    getIO().in(member.userId).socketsJoin(allowChannelIds);
  }
}

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
