import { Channel, Prisma, Server, ServerMember, ServerRole } from '@src/generated/prisma/client';
import { getUserPresences } from '../cache/UserCache';
import { CustomResult } from '../common/CustomResult';
import { exists, prisma, publicUserExcludeFields, removeServerIdFromAccountOrder } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../common/Bitwise';
import { generateHexColor } from '../common/random';
import { emitServerChannelOrderUpdated, emitServerEmojiAdd, emitServerEmojiRemove, emitServerEmojiUpdate, emitServerJoined, emitServerLeft, emitServerOrderUpdated, emitServerUpdated } from '../emits/Server';
import { ChannelType } from '../types/Channel';
import { createMessage, deleteRecentUserServerMessages } from './Message/Message';
import { MessageType } from '../types/Message';
import { emitUserPresenceUpdateTo } from '../emits/User';
import { deleteAllInboxCache, deleteAllInboxCacheInServer, deleteServerChannelCaches, removeServerMemberPermissionsCache } from '../cache/ChannelCache';
import { getVoiceUsersByChannelId } from '../cache/VoiceCache';
import { deleteAllServerMemberCache, deleteServerMemberCache } from '../cache/ServerMemberCache';
import { Log } from '../common/Log';
import { deleteServerCache, updateServerCache } from '../cache/ServerCache';
import { getExploreItem, getPublicServer } from './Explore';
import { createServerRole, deleteServerRole } from './ServerRole';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { removeDuplicates } from '../common/utils';
import { LastOnlineStatus } from './User/User';
import { addServerAuditLog, AuditLogType, logServerDelete, logServerOwnershipUpdate, logServerUserBanned, logServerUserKicked, logServerUserUnbanned } from './AuditLog';
import { removeManyWebhookCache } from '../cache/WebhookCache';
import { createSystemMessage } from './Message/MessageCreateSystem';

const ServerMemberWithLastOnlineDetails = {
  include: { user: { select: { ...publicUserExcludeFields, lastOnlineAt: true, lastOnlineStatus: true } } },
} satisfies { include: Prisma.ServerMemberInclude };

type ServerMemberWithLastOnlineDetails = Prisma.ServerMemberGetPayload<typeof ServerMemberWithLastOnlineDetails>;

const filterLastOnlineDetailsFromServerMembers = (serverMembers: ServerMemberWithLastOnlineDetails[], requesterUserId: string) => {
  return serverMembers.map((serverMember) => {
    if (serverMember.userId === requesterUserId) {
      return serverMember;
    }
    const isPrivacyFriendsAndServers = serverMember.user?.lastOnlineStatus === LastOnlineStatus.FRIENDS_AND_SERVERS;

    const { lastOnlineAt, ...user } = serverMember.user;
    const newObj = {
      ...serverMember,
      user: {
        ...user,
        ...(isPrivacyFriendsAndServers ? { lastOnlineAt } : { lastOnlineAt: null }),
      },
    };

    return newObj;
  });
};
interface CreateServerOptions {
  name: string;
  creatorId: string;
}

export const hasReachedMaxServers = async (userId: string): Promise<boolean> => {
  const serverCount = await prisma.serverMember.count({
    where: { userId },
  });
  return serverCount > 100;
};

export const createServer = async (opts: CreateServerOptions): Promise<CustomResult<Server, CustomError>> => {
  const maxServersReached = await hasReachedMaxServers(opts.creatorId);
  if (maxServersReached) {
    return [null, generateError('You have reached the maximum number of servers.')];
  }

  const serverId = generateId();
  const channelId = generateId();
  const serverMemberId = generateId();
  const roleId = generateId();

  const [server, defaultRole, channel, user, serverMember] = await prisma.$transaction([
    prisma.server.create({
      data: {
        id: serverId,
        name: opts.name.trim(),
        createdById: opts.creatorId,
        defaultChannelId: channelId,
        defaultRoleId: roleId,
        hexColor: generateHexColor(),
      },
      include: {
        customEmojis: {
          select: { gif: true, id: true, name: true },
        },
      },
    }),
    prisma.serverRole.create({
      data: {
        id: roleId,
        name: 'All',
        serverId,
        permissions: ROLE_PERMISSIONS.SEND_MESSAGE.bit,

        order: 1,

        createdById: opts.creatorId,
      },
    }),
    prisma.channel.create({
      data: {
        id: channelId,
        name: 'General',
        serverId: serverId,
        type: ChannelType.SERVER_TEXT,
        permissions: {
          create: {
            id: generateId(),
            serverId: serverId,
            roleId: roleId,
            permissions: addBit(CHANNEL_PERMISSIONS.SEND_MESSAGE.bit, addBit(CHANNEL_PERMISSIONS.JOIN_VOICE.bit, CHANNEL_PERMISSIONS.PUBLIC_CHANNEL.bit)),
          },
        },
        createdById: opts.creatorId,
        order: 1,
      },
      include: { _count: { select: { attachments: true } }, permissions: { select: { permissions: true, memberId: true, roleId: true } } },
    }),
    prisma.user.update({
      where: { id: opts.creatorId },
      data: { servers: { connect: { id: serverId } } },
    }),
    prisma.serverMember.create({
      data: { id: serverMemberId, serverId, userId: opts.creatorId },
      include: { user: true },
    }),
    prisma.server.update({
      where: { id: serverId },
      data: { systemChannelId: channelId },
    }),
  ]);

  server.systemChannelId = channelId;

  emitServerJoined({
    server: server,
    channels: [channel],
    members: [serverMember],
    roles: [defaultRole],
    joinedMember: serverMember,
    memberPresences: [],
    voiceChannelUsers: [],
  });
  return [server, null];
};

export const getServers = async (userId: string, includeCurrentUserServerMembersOnly = false) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      servers: {
        include: {
          scheduledForDeletion: {
            select: {
              scheduledAt: true,
            },
          },
          _count: { select: { welcomeQuestions: true } },
          channels: {
            where: { deleting: null },
            include: { _count: { select: { attachments: true } }, permissions: { select: { permissions: true, memberId: true, roleId: true } } },
          },
          serverMembers: {
            ...(includeCurrentUserServerMembersOnly ? { where: { userId } } : {}),
            include: { user: { select: { ...publicUserExcludeFields, profile: { select: { font: true } }, lastOnlineAt: true, lastOnlineStatus: true } } },
          },
          roles: true,
          customEmojis: {
            select: {
              id: true,
              gif: true,
              name: true,
              webp: true,
            },
          },
        },
      },
    },
  });
  const servers = user?.servers || [];
  let serverChannels: Channel[] = [];
  let serverMembers: ServerMemberWithLastOnlineDetails[] = [];

  let serverRoles: ServerRole[] = [];

  for (let i = 0; i < servers.length; i++) {
    const server = servers[i]!;
    const updatedServerMembers = filterLastOnlineDetailsFromServerMembers(server.serverMembers, userId);
    server.serverMembers = updatedServerMembers;

    serverChannels = [...serverChannels, ...server.channels];
    serverMembers = [...serverMembers, ...server.serverMembers];
    serverRoles = [...serverRoles, ...server.roles];
  }

  return {
    servers: user?.servers || [],
    serverChannels,
    serverMembers,
    serverRoles,
  };
};

export const getServerIds = async (userId: string): Promise<string[]> => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { servers: { select: { id: true } } },
  });
  return user?.servers.map((server) => server.id) || [];
};

export const joinServer = async (
  userId: string,
  serverId: string,
  bot?: {
    permissions: number;
    botName: string;
  },
): Promise<CustomResult<Server, CustomError>> => {
  const maxServersReached = bot ? false : await hasReachedMaxServers(userId);
  if (maxServersReached) {
    return [null, generateError('You have reached the maximum number of servers.')] as const;
  }

  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: {
      scheduledForDeletion: true,
      _count: { select: { welcomeQuestions: true } },
      customEmojis: {
        select: { gif: true, id: true, name: true },
      },
    },
  });
  if (!server) {
    return [null, generateError('Server does not exist.')] as const;
  }

  if (server.scheduledForDeletion) {
    return [null, generateError('Server is scheduled for deletion.')] as const;
  }

  // check if user is already in server
  const isInServer = await exists(prisma.serverMember, {
    where: { serverId, userId },
  });
  if (isInServer) {
    return [null, generateError(bot ? 'This bot is already in this server' : 'You are already in this server.')] as const;
  }

  const isBanned = await exists(prisma.bannedServerMember, {
    where: { serverId, userId },
  });

  if (isBanned) {
    return [null, generateError('You are banned from this server')] as const;
  }

  let botRoleId: string | null = null;

  if (bot) {
    const [botRole, botRoleError] = await createServerRole(bot.botName, userId, serverId, { bot: true, permissions: bot.permissions });
    if (botRoleError) {
      return [null, botRoleError] as const;
    }
    botRoleId = botRole?.id || null;
  }

  const applyOnJoinRoles = await prisma.serverRole.findMany({ where: { serverId, applyOnJoin: true }, select: { id: true } });
  const applyOnJoinRoleIds = applyOnJoinRoles.map((role) => role.id);

  const [_, serverRoles, serverMember, serverChannels, serverMembers] = await prisma
    .$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { servers: { connect: { id: serverId } } },
      }),
      prisma.serverRole.findMany({ where: { serverId } }),
      prisma.serverMember.create({
        data: {
          id: generateId(),
          serverId,
          userId,
          roleIds: botRoleId ? [botRoleId, ...applyOnJoinRoleIds] : applyOnJoinRoleIds,
        },
        include: { user: { select: { ...publicUserExcludeFields, profile: { select: { font: true } } } } },
      }),
      prisma.channel.findMany({
        where: { serverId: server.id, deleting: null },
        include: { _count: { select: { attachments: true } }, permissions: { select: { permissions: true, memberId: true, roleId: true } } },
      }),
      prisma.serverMember.findMany({
        where: { serverId: server.id },
        include: { user: { select: { ...publicUserExcludeFields, profile: { select: { font: true } }, lastOnlineAt: true, lastOnlineStatus: true } } },
      }),
    ])
    .catch(() => []);
  if (!serverMember) {
    if (botRoleId) {
      await deleteServerRole(serverId, botRoleId);
    }
    return [null, generateError('Failed to join server. Please try again.')] as const;
  }

  const updatedServerMembers = filterLastOnlineDetailsFromServerMembers(serverMembers, userId);

  const memberIds = serverMembers.map((sm) => sm.user.id);
  const memberPresences = await getUserPresences(memberIds);

  const channelIds = await serverChannels.map((channel) => channel.id);
  const voiceChannelUsers = await getVoiceUsersByChannelId(channelIds);

  emitServerJoined({
    server: server,
    channels: serverChannels,
    members: updatedServerMembers,
    roles: serverRoles,
    joinedMember: serverMember,
    memberPresences,
    voiceChannelUsers,
  });

  deleteAllInboxCache(userId);
  const [userPresence] = await getUserPresences([userId]);
  userPresence && emitUserPresenceUpdateTo(serverId, userPresence);

  if (server.systemChannelId) {
    await createSystemMessage({
      channelId: server.systemChannelId,
      type: MessageType.JOIN_SERVER,
      serverId: serverId,
      userId: userId,
    });
  }

  return [server, null] as const;
};

export const deleteServer = async (serverId: string, deletedByUserId: string) => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: { channels: { select: { id: true } }, webhooks: { select: { id: true } } },
  });

  if (!server) {
    return [null, generateError('Server does not exist.')] as const;
  }

  await removeManyWebhookCache(server.webhooks.map((webhook) => webhook.id));

  await deleteAllInboxCacheInServer(serverId);
  await prisma.$transaction([
    prisma.webhook.updateMany({ where: { serverId }, data: { deleting: true } }),
    prisma.server.delete({ where: { id: serverId } }),
    prisma.channel.updateMany({
      where: { serverId },
      data: { deleting: true },
    }),
    ...server.channels.map(({ id }) =>
      prisma.scheduleMessageDelete.upsert({
        where: { channelId: id },
        create: { channelId: id },
        update: {},
      }),
    ),
  ]);

  await deleteServerChannelCaches(server.channels.map((channel) => channel.id));
  await deleteServerCache(serverId);

  await logServerDelete({
    serverId,
    serverName: server.name,
    userId: deletedByUserId,
  });

  emitServerLeft({
    serverId,
    serverDeleted: true,
  });

  Log.info(`Server (${server.name}) deleted.`);

  return [true, null] as const;
};

interface LeaveServerOptions {
  userId: string;
  serverId: string;
  ban?: boolean;
  leaveMessage?: boolean;
  reason?: string;
}

export const leaveServer = async (opts: LeaveServerOptions): Promise<CustomResult<boolean, CustomError>> => {
  const ban = opts.ban ?? false;
  const leaveMessage = opts.leaveMessage ?? true;

  const server = await prisma.server.findUnique({
    where: { id: opts.serverId },
    include: { channels: { select: { id: true } }, scheduledForDeletion: true },
  });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const isServerCreator = server.createdById === opts.userId;

  if (isServerCreator) {
    return [null, generateError('You cannot leave your own server.')];
  }

  // check if user is in the server
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { serverId: opts.serverId, userId: opts.userId } },
    include: { user: { select: { bot: true, account: { select: { id: true } } } } },
  });
  if (!member && !ban) {
    return [null, generateError('You are not in this server.')];
  }

  await deleteServerMemberCache(opts.serverId, opts.userId);
  if (!member && ban) {
    const isBanned = await prisma.bannedServerMember.findFirst({
      where: { serverId: opts.serverId, userId: opts.userId },
    });
    if (isBanned) {
      return [null, generateError('User already banned.')];
    }
    await prisma.bannedServerMember.create({
      data: {
        id: generateId(),
        userId: opts.userId,
        serverId: opts.serverId,
        reason: opts.reason,
      },
    });
    deleteAllInboxCache(opts.userId);
    return [true, null];
  }

  const transactions: any[] = [
    prisma.user.update({
      where: { id: opts.userId },
      data: { servers: { disconnect: { id: opts.serverId } } },
    }),
    prisma.serverMember.delete({
      where: { userId_serverId: { serverId: opts.serverId, userId: opts.userId } },
    }),
    prisma.messageMention.deleteMany({
      where: { serverId: opts.serverId, mentionedToId: opts.userId },
    }),
    prisma.serverChannelLastSeen.deleteMany({
      where: { serverId: opts.serverId, userId: opts.userId },
    }),
    prisma.userNotificationSettings.deleteMany({
      where: {
        OR: [{ serverId: opts.serverId }, { channel: { serverId: opts.serverId } }],
        userId: opts.userId,
      },
    }),
  ];
  if (ban) {
    transactions.push(
      prisma.bannedServerMember.create({
        data: {
          id: generateId(),
          userId: opts.userId,
          serverId: opts.serverId,
          reason: opts.reason,
        },
      }),
    );
  }
  await prisma.$transaction(transactions);

  const channelIds = server.channels.map((channel) => channel.id);

  await removeServerMemberPermissionsCache(channelIds, [opts.userId]);

  deleteAllInboxCache(opts.userId);
  if (member?.user.account?.id) {
    await removeServerIdFromAccountOrder(member.user.account.id, opts.serverId);
  }
  if (!server.scheduledForDeletion && server.systemChannelId && leaveMessage) {
    await createSystemMessage({
      channelId: server.systemChannelId,
      type: MessageType.LEAVE_SERVER,
      userId: opts.userId,
      serverId: opts.serverId,
    });
  }

  emitServerLeft({
    userId: opts.userId,
    serverId: opts.serverId,
    channelIds,
  });

  if (member?.user.bot) {
    const botRole = await prisma.serverRole.findFirst({
      where: { serverId: opts.serverId, createdById: opts.userId, botRole: true },
    });
    if (botRole) {
      await deleteServerRole(opts.serverId, botRole.id, {
        forceDeleteBotRole: true,
      });
    }
  }

  return [false, null];
};

export const kickServerMember = async (userId: string, serverId: string, kickedByUserId: string) => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  if (server.createdById === userId) {
    return [null, generateError('You can not kick yourself.')];
  }

  const [, error] = await leaveServer({ userId, serverId, leaveMessage: false, ban: false });
  if (error) return [null, error];

  if (server.systemChannelId) {
    await createSystemMessage({
      channelId: server.systemChannelId,
      type: MessageType.KICK_USER,
      userId,
      serverId,
    });
  }

  await logServerUserKicked({ userId: kickedByUserId, serverId, kickedUserId: userId });
  return [true, null];
};

export const serverMemberBans = async (serverId: string) => {
  return prisma.bannedServerMember.findMany({
    where: { serverId },
    select: { serverId: true, user: true, bannedAt: true, reason: true },
    orderBy: { bannedAt: 'desc' },
  });
};
export const serverMemberRemoveBan = async (serverId: string, userId: string, banRemovedById: string): Promise<CustomResult<boolean, CustomError>> => {
  const bannedMember = await prisma.bannedServerMember.findFirst({
    where: { serverId, userId },
  });
  if (!bannedMember) {
    return [null, generateError('This member is not banned.')];
  }
  await prisma.bannedServerMember.delete({ where: { id: bannedMember.id } });

  await logServerUserUnbanned({ userId: banRemovedById, serverId, unbannedUserId: userId });

  return [true, null];
};

export const banServerMember = async (userId: string, serverId: string, bannedByUserId?: string, shouldDeleteRecentMessages?: boolean, reason?: string) => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  if (server.createdById === userId) {
    return [null, generateError('You can not ban yourself.')];
  }

  const userToBan = await prisma.user.findFirst({
    where: { id: userId },
    select: { id: true },
  });
  if (!userToBan) {
    return [null, generateError('Invalid userId')];
  }

  const [, error] = await leaveServer({ userId, serverId, leaveMessage: false, ban: true, reason });
  if (error) return [null, error];

  await logServerUserBanned({
    userId: bannedByUserId,
    serverId,
    reason,
    bannedUserId: userId,
  });

  if (shouldDeleteRecentMessages) {
    await deleteRecentUserServerMessages(userId, serverId);
  }

  if (server.systemChannelId) {
    await createSystemMessage({
      channelId: server.systemChannelId,
      type: MessageType.BAN_USER,
      userId,
      serverId,
    });
  }
  return [true, null];
};

export interface UpdateServerOptions {
  name?: string;
  defaultChannelId?: string;
  systemChannelId?: string | null;
  avatar?: string;
  banner?: string;
  verified?: boolean;
  createdById?: string;
}

export const updateServer = async (serverId: string, update: UpdateServerOptions, actionById?: string): Promise<CustomResult<UpdateServerOptions, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  let defaultChannel: Channel | null = null;
  let systemChannel: Channel | null = null;

  // check if channel is a server channel
  if (update.defaultChannelId) {
    defaultChannel = await prisma.channel.findFirst({
      where: { id: update.defaultChannelId },
    });
    if (!defaultChannel || defaultChannel.serverId !== serverId) {
      return [null, generateError('Invalid defaultChannelId')];
    }
  }
  if (update.systemChannelId) {
    systemChannel = await prisma.channel.findFirst({
      where: { id: update.systemChannelId },
    });
    if (!systemChannel || systemChannel.serverId !== serverId) {
      return [null, generateError('Invalid systemChannelId')];
    }
  }

  if (update.name && update.name?.trim() !== server.name.trim()) {
    update.verified = false;
  }

  await prisma.server.update({ where: { id: serverId }, data: update });
  emitServerUpdated(serverId, update);

  if (actionById) {
    addServerAuditLog({
      actionType: AuditLogType.SERVER_UPDATE,
      actionById: actionById,
      serverId: serverId,
      data: {
        ...addToObjectIfExists('name', update.name),
        ...addToObjectIfExists('defaultChannelName', update.defaultChannelId, defaultChannel?.name),
        ...addToObjectIfExists('systemChannelName', update.systemChannelId, update.systemChannelId ?? systemChannel?.name),
        ...addToObjectIfExists('avatar', update.avatar, !!update.avatar),
        ...addToObjectIfExists('banner', update.banner, !!update.banner),
      },
    });
  }

  return [update, null];
};

interface AddServerEmojiOpts {
  name: string;
  serverId: string;
  uploadedById: string;
  emojiPath: string;
  emojiId: string;
  animated?: boolean;
}

async function hasReachedMaxServerEmojis(serverId?: string) {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    select: { verified: true },
  });
  if (!server) return true;

  const emojiCount = await prisma.customEmoji.count({ where: { serverId } });
  if (server.verified) {
    return emojiCount >= 200;
  }
  return emojiCount >= 80;
}

export const addServerEmoji = async (opts: AddServerEmojiOpts) => {
  if (await hasReachedMaxServerEmojis(opts.serverId)) return [null, 'You have reached the maximum number of emojis for this server.'] as const;

  opts.name = opts.name.replace(/[^0-9a-zA-Z]/g, '_');

  const result = await prisma.customEmoji.create({
    data: {
      id: opts.emojiId,
      name: opts.name,
      gif: opts.animated || false,
      webp: opts.emojiPath.endsWith('.webp') || opts.emojiPath.endsWith('.webp#a'),
      serverId: opts.serverId,
      uploadedById: opts.uploadedById,
    },
  });

  emitServerEmojiAdd(opts.serverId, result);
  return [result, null] as const;
};

export const getServerEmojis = async (serverId: string) => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: {
      customEmojis: { orderBy: { id: 'desc' }, include: { uploadedBy: true } },
    },
  });
  if (!server) return [null, 'Server not found.'] as const;
  return [server.customEmojis, null] as const;
};

export const updateServerOrder = async (userId: string, _orderedServerIds: string[]) => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { servers: { select: { id: true } }, account: { select: { serverFolders: { select: { id: true } } } } },
  });

  if (!user || !user.account) {
    return [null, generateError('User does not exist.')];
  }

  const newOrderedServerIds = removeDuplicates(_orderedServerIds);

  if (newOrderedServerIds.length !== _orderedServerIds.length) {
    return [null, generateError('Duplicate server ids.')];
  }
  const joinedServerIds = user.servers.map((server) => server.id);
  const folderIds = user.account.serverFolders.map((folder) => folder.id);

  if (joinedServerIds.length + folderIds.length !== newOrderedServerIds.length) {
    return [null, generateError('Server order length does not match.')];
  }

  const doesNotExistServer = joinedServerIds.filter((id) => !newOrderedServerIds.includes(id));
  const doesNotExistFolder = doesNotExistServer.filter((id) => !newOrderedServerIds.includes(id));

  if (doesNotExistFolder.length) {
    return [null, generateError('Invalid server ids.')];
  }

  await prisma.account.update({
    where: { userId },
    data: {
      serverOrderIds: newOrderedServerIds,
    },
  });

  emitServerOrderUpdated(userId, newOrderedServerIds);

  return [{ success: true }, null];
};

export const updateServerEmoji = async (serverId: string, emojiId: string, newName: string) => {
  const emoji = await prisma.customEmoji.findFirst({
    where: { id: emojiId, serverId },
  });
  if (!emoji) return [null, 'Emoji not found.'] as const;

  newName = newName.trim().replace(/[^0-9a-zA-Z]/g, '_');

  const newEmoji = await prisma.customEmoji
    .update({
      where: { id: emojiId },
      data: { name: newName },
    })
    .catch(() => null);

  if (!newEmoji) return [null, 'Emoji not found.'] as const;

  emitServerEmojiUpdate(serverId, emojiId, newName);
  return [newEmoji, null] as const;
};

export const deleteServerEmoji = async (serverId: string, emojiId: string) => {
  const emoji = await prisma.customEmoji.findFirst({
    where: { id: emojiId, serverId },
  });
  if (!emoji) return [null, 'Emoji not found.'] as const;

  await prisma.customEmoji.delete({ where: { id: emoji.id } });
  // await nerimityCDN.deleteImage('emojis/' + emoji.id + (emoji.gif ? '.gif' : '.webp'));
  emitServerEmojiRemove(serverId, emojiId);
  return [true, null] as const;
};

interface UpdateServerChannelOrderOpts {
  serverId: string;
  categoryId?: string;
  orderedChannelIds: string[];
}

// TODO: make orderChannelIds cant contain a channel type of category when categoryId is provided.
export async function updateServerChannelOrder(opts: UpdateServerChannelOrderOpts) {
  const serverChannels = await prisma.channel.findMany({
    where: { serverId: opts.serverId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  const channels: { [key: string]: Channel } = {};

  for (let i = 0; i < serverChannels.length; i++) {
    const channel = serverChannels[i];
    channels[channel.id] = channel;
  }

  if (opts.categoryId) {
    const category = channels[opts.categoryId];

    const exists = () => category;
    const isCategory = () => category.type === ChannelType.CATEGORY;

    if (!exists() || !isCategory()) {
      return [null, generateError('Invalid categoryId.')] as const;
    }
  }

  const hasInvalidId = opts.orderedChannelIds.find((id) => {
    const channel = channels[id];
    if (!channel) return true;
    if (channel.type === ChannelType.CATEGORY && opts.categoryId) return true;
  });
  if (hasInvalidId) {
    return [null, generateError('Invalid channel ids.')] as const;
  }

  await prisma.$transaction(
    serverChannels.map((channel) =>
      prisma.channel.update({
        where: { id: channel.id },
        data: {
          ...(opts.orderedChannelIds.includes(channel.id) ? { order: opts.orderedChannelIds.indexOf(channel.id) + 1 } : undefined),

          // update or add categoryId
          ...(opts.categoryId && opts.categoryId !== channel.categoryId && opts.orderedChannelIds.includes(channel.id)
            ? {
                categoryId: opts.categoryId,
              }
            : undefined),
          // remove categoryId
          ...(!opts.categoryId && channel.categoryId && opts.orderedChannelIds.includes(channel.id)
            ? {
                categoryId: null,
              }
            : undefined),
        },
      }),
    ),
  );

  const payload = {
    categoryId: opts.categoryId,
    orderedChannelIds: opts.orderedChannelIds,
  };

  emitServerChannelOrderUpdated(opts.serverId, payload);
  return [payload, null] as const;
}

export const getPublicServerFromEmoji = async (emojiId: string) => {
  const emoji = await prisma.customEmoji.findUnique({
    where: { id: emojiId },
  });

  if (!emoji) return [null, generateError('Emoji not found.')] as const;

  return getExploreItem({ serverId: emoji.serverId });
};

interface Answer {
  title: string;
  roleIds: string[];
  order: number;
}

interface AddServerWelcomeQuestionOpts {
  serverId: string;
  title: string;
  multiselect: boolean;
  answers: Answer[];
}

export const addServerWelcomeQuestion = async (opts: AddServerWelcomeQuestionOpts) => {
  for (let i = 0; i < opts.answers.length; i++) {
    const answer = opts.answers[i]!;
    if (answer.order && (answer.order < 0 || answer.order > 20)) return [null, generateError('Invalid order.')] as const;
  }

  const server = await prisma.server.findUnique({
    where: { id: opts.serverId },
  });
  if (!server) return [null, generateError('Server not found.')] as const;

  const count = await prisma.serverWelcomeQuestion.count({
    where: {
      serverId: opts.serverId,
    },
  });

  if (count >= 10) return [null, generateError('Maximum number of welcome questions reached.')] as const;

  if (opts.answers.length > 10) return [null, generateError('Maximum number of answers reached.')] as const;

  const validRoles = await prisma.serverRole.findMany({
    where: {
      OR: [{ botRole: false }, { botRole: null }],
      serverId: opts.serverId,
      id: {
        in: opts.answers.flatMap((answer) => answer.roleIds || []),
        not: server.defaultRoleId,
      },
    },
    select: { id: true },
  });
  const validRoleIds = validRoles.map((validRole) => validRole.id);

  const newQuestion = await prisma.serverWelcomeQuestion.create({
    data: {
      id: generateId(),
      serverId: opts.serverId,
      title: opts.title,
      multiselect: opts.multiselect,
      order: count + 1,
      answers: {
        createMany: {
          data: opts.answers.map((answer) => ({
            id: generateId(),
            title: answer.title,
            roleIds: removeDuplicates(answer.roleIds.filter((roleId) => validRoleIds.includes(roleId)) || []),
            order: answer.order,
          })),
        },
      },
    },
    include: {
      answers: true,
    },
  });

  const channelPermissions = await prisma.serverChannelPermissions.findMany({
    where: { serverId: opts.serverId },
    select: { channelId: true },
  });
  const channelIds = removeDuplicates(channelPermissions.map((permission) => permission.channelId));
  await deleteServerChannelCaches(channelIds, false);

  return [newQuestion, null] as const;
};

type UpdateServerWelcomeQuestionOpts = {
  id: string;
  serverId: string;
  title?: string;
  order?: number;
  multiselect?: boolean;
  answers: Partial<Answer & { id: string }>[];
};

export const updateServerWelcomeQuestion = async (opts: UpdateServerWelcomeQuestionOpts) => {
  if (opts.order && (opts.order < 0 || opts.order > 20)) return [null, generateError('Invalid order.')] as const;

  if (opts.answers) {
    for (let i = 0; i < opts.answers.length; i++) {
      const answer = opts.answers[i]!;
      if (answer.order && (answer.order < 0 || answer.order > 20)) return [null, generateError('Invalid order.')] as const;
    }
  }

  const questionExists = await prisma.serverWelcomeQuestion.findUnique({
    where: { id: opts.id, serverId: opts.serverId },
  });
  if (!questionExists) return [null, generateError('Question not found.')] as const;

  const server = await prisma.server.findUnique({
    where: { id: opts.serverId },
  });
  if (!server) return [null, generateError('Server not found.')] as const;

  if (opts.answers.length > 10) return [null, generateError('Maximum number of answers reached.')] as const;

  const validRoles = await prisma.serverRole.findMany({
    where: {
      serverId: opts.serverId,
      OR: [{ botRole: false }, { botRole: null }],
      id: {
        in: opts.answers.flatMap((answer) => answer.roleIds || []).filter((roleId) => roleId),
        not: server.defaultRoleId,
      },
    },
    select: { id: true, botRole: true },
  });
  const validRoleIds = validRoles.map((validRole) => validRole.id);

  const existingAnswers = await prisma.serverWelcomeAnswer.findMany({
    where: { questionId: opts.id },
  });
  const existingAnswerIds = existingAnswers.map((answer) => answer.id);
  const removedAnswerIds = existingAnswerIds.filter((id) => !opts.answers.find((answer) => answer.id === id));

  await prisma.$transaction([
    ...(opts.answers.length && removedAnswerIds.length
      ? [
          prisma.serverWelcomeAnswer.deleteMany({
            where: { id: { in: removedAnswerIds }, questionId: opts.id },
          }),
        ]
      : []),
    prisma.serverWelcomeQuestion.update({
      where: { id: opts.id },
      data: {
        ...addToObjectIfExists('title', opts.title),
        ...addToObjectIfExists('multiselect', opts.multiselect),
        ...addToObjectIfExists('order', opts.order),
      },
    }),
    ...opts.answers.map((answer) =>
      prisma.serverWelcomeAnswer.upsert({
        where: { id: answer.id, questionId: opts.id },
        create: {
          id: generateId(),
          questionId: opts.id,
          title: answer.title || 'Untitled Answer',
          order: answer.order!,
          roleIds: removeDuplicates(answer.roleIds?.filter((roleId) => validRoleIds.includes(roleId)) || []),
        },
        update: {
          ...addToObjectIfExists('title', answer.title),
          ...addToObjectIfExists('order', answer.order),
          ...(answer.roleIds
            ? {
                roleIds: {
                  set: removeDuplicates(answer.roleIds.filter((roleId) => validRoleIds.includes(roleId)) || []),
                },
              }
            : {}),
        },
      }),
    ),
  ]);

  const question = await prisma.serverWelcomeQuestion.findUnique({
    where: { id: opts.id },
    include: {
      answers: {
        select: {
          id: true,
          title: true,
          roleIds: true,
          order: true,
        },
      },
    },
  });

  const channelPermissions = await prisma.serverChannelPermissions.findMany({
    where: { serverId: opts.serverId },
    select: { channelId: true },
  });
  const channelIds = removeDuplicates(channelPermissions.map((permission) => permission.channelId));
  await deleteServerChannelCaches(channelIds, false);

  return [question, null] as const;
};

export const getServerWelcomeQuestions = async (serverId: string, memberId?: string) => {
  const questions = await prisma.serverWelcomeQuestion.findMany({
    where: { serverId },
    orderBy: { createdAt: 'asc' },
    include: {
      answers: {
        orderBy: { createdAt: 'asc' },
        select: {
          order: true,
          _count: { select: { answeredUsers: true } },
          ...(memberId ? { answeredUsers: { take: 1, where: { memberId }, select: { id: true } } } : {}),
          id: true,
          title: true,
          roleIds: true,
          questionId: true,
          createdAt: true,
        },
      },
    },
  });
  const formattedQuestions = questions.map((question) => {
    return {
      ...question,
      answers: question.answers.map((answer) => ({
        ...answer,
        answeredUsers: undefined,
        ...(memberId ? { answered: answer.answeredUsers.length > 0 } : {}),
      })),
    };
  });
  return [formattedQuestions, null] as const;
};

export const deleteQuestion = async (serverId: string, questionId: string) => {
  const question = await prisma.serverWelcomeQuestion.deleteMany({
    where: { serverId, id: questionId },
  });
  if (!question.count) {
    return [null, generateError('Question not found.')] as const;
  }

  const channelPermissions = await prisma.serverChannelPermissions.findMany({
    where: { serverId },
    select: { channelId: true },
  });
  const channelIds = removeDuplicates(channelPermissions.map((permission) => permission.channelId));
  await deleteServerChannelCaches(channelIds, false);

  return [true, null] as const;
};

export const getServerWelcomeQuestion = async (serverId: string, questionId: string) => {
  const question = await prisma.serverWelcomeQuestion.findFirst({
    where: { serverId: serverId, id: questionId },
    include: {
      answers: {
        orderBy: { createdAt: 'asc' },
        select: {
          order: true,
          _count: { select: { answeredUsers: true } },
          id: true,
          title: true,
          roleIds: true,
          questionId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!question) return [null, generateError('Question not found.')] as const;

  return [question, null] as const;
};

interface TransferServerOwnershipOpts {
  newOwnerUserId: string;
  serverId: string;
}
export const transferServerOwnership = async (opts: TransferServerOwnershipOpts) => {
  const server = await prisma.server.findFirst({ where: { id: opts.serverId }, select: { createdById: true } });
  if (!server) return [null, generateError('Server not found.')] as const;
  if (server.createdById === opts.newOwnerUserId) return [null, generateError('Cannot transfer ownership to yourself.')] as const;

  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: opts.newOwnerUserId, serverId: opts.serverId } },
    select: {
      id: true,

      user: {
        select: {
          bot: true,
          account: true,
        },
      },
    },
  });
  if (!member) return [null, generateError('Member not found.')] as const;
  if (member.user.bot) return [null, generateError('Cannot transfer ownership to a bot account.')] as const;
  if (!member.user.account) return [null, generateError('Invalid user account.')] as const;

  await prisma.server.update({
    where: { id: opts.serverId },
    data: { createdById: opts.newOwnerUserId, verified: false },
  });

  await updateServerCache(opts.serverId, { createdById: opts.newOwnerUserId });

  emitServerUpdated(opts.serverId, { createdById: opts.newOwnerUserId, verified: false });
  logServerOwnershipUpdate({ serverId: opts.serverId, newOwnerUserId: opts.newOwnerUserId, oldOwnerUserId: server.createdById });

  return [true, null] as const;
};
