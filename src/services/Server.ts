import { Channel, Server } from '@prisma/client';
import { getUserPresences } from '../cache/UserCache';
import { CustomResult } from '../common/CustomResult';
import { exists, prisma, publicUserExcludeFields, removeServerIdFromAccountOrder } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../common/Bitwise';
import { generateHexColor } from '../common/random';
import { emitServerChannelOrderUpdated, emitServerEmojiAdd, emitServerEmojiRemove, emitServerEmojiUpdate, emitServerFolderCreated, emitServerFolderUpdated, emitServerJoined, emitServerLeft, emitServerOrderUpdated, emitServerUpdated } from '../emits/Server';
import { ChannelType } from '../types/Channel';
import { createMessage, deleteRecentUserServerMessages } from './Message';
import { MessageType } from '../types/Message';
import { emitUserPresenceUpdateTo } from '../emits/User';
import * as nerimityCDN from '../common/nerimityCDN';
import { makeChannelsInCategoryPrivate } from './Channel';
import { deleteAllInboxCache, deleteAllInboxCacheInServer, deleteServerChannelCaches } from '../cache/ChannelCache';
import { getVoiceUsersByChannelId } from '../cache/VoiceCache';
import { leaveVoiceChannel } from './Voice';
import { deleteServerMemberCache } from '../cache/ServerMemberCache';
import { Log } from '../common/Log';
import { deleteServerCache } from '../cache/ServerCache';
import { getPublicServer } from './Explore';
import { createServerRole, deleteServerRole } from './ServerRole';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { removeDuplicates } from '../common/utils';

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
        hexColor: env.DEFAULT_SERVER_ROLE_COLOR,

        createdById: opts.creatorId,
      },
    }),
    prisma.channel.create({
      data: {
        id: channelId,
        name: 'General',
        serverId: serverId,
        type: ChannelType.SERVER_TEXT,
        permissions: addBit(CHANNEL_PERMISSIONS.SEND_MESSAGE.bit, CHANNEL_PERMISSIONS.JOIN_VOICE.bit),
        createdById: opts.creatorId,
        order: 1,
      },
      include: { _count: { select: { attachments: true } } },
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

export const getServers = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      servers: {
        include: {
          _count: { select: { welcomeQuestions: true } },
          customEmojis: {
            select: {
              id: true,
              gif: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const serverIds = user?.servers.map((server) => server.id);

  const [serverChannels, serverMembers, serverRoles] = await prisma.$transaction([
    prisma.channel.findMany({
      where: { serverId: { in: serverIds }, deleting: null },
      include: { _count: { select: { attachments: true } } },
    }),
    prisma.serverMember.findMany({
      where: { serverId: { in: serverIds } },
      include: { user: { select: publicUserExcludeFields } },
    }),
    prisma.serverRole.findMany({ where: { serverId: { in: serverIds } } }),
  ]);

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
  }
): Promise<CustomResult<Server, CustomError>> => {
  const maxServersReached = await hasReachedMaxServers(userId);
  if (maxServersReached) {
    return [null, generateError('You have reached the maximum number of servers.')] as const;
  }

  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: {
      _count: { select: { welcomeQuestions: true } },
      customEmojis: {
        select: { gif: true, id: true, name: true },
      },
    },
  });
  if (!server) {
    return [null, generateError('Server does not exist.')] as const;
  }

  // check if user is already in server
  const isInServer = await exists(prisma.serverMember, {
    where: { serverId, userId },
  });
  if (isInServer) {
    return [null, generateError('You are already in this server.')] as const;
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

  const [_, serverRoles, serverMember, serverChannels, serverMembers] = await prisma.$transaction([
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
        roleIds: botRoleId ? [botRoleId] : [],
      },
      include: { user: { select: publicUserExcludeFields } },
    }),
    prisma.channel.findMany({
      where: { serverId: server.id, deleting: null },
      include: { _count: { select: { attachments: true } } },
    }),
    prisma.serverMember.findMany({
      where: { serverId: server.id },
      include: { user: { select: publicUserExcludeFields } },
    }),
  ]);

  if (server.systemChannelId) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.JOIN_SERVER,
      serverId: serverId,
      userId: userId,
    });
  }
  const memberIds = serverMembers.map((sm) => sm.user.id);
  const memberPresences = await getUserPresences(memberIds);

  const channelIds = await serverChannels.map((channel) => channel.id);
  const voiceChannelUsers = await getVoiceUsersByChannelId(channelIds);

  emitServerJoined({
    server: server,
    channels: serverChannels,
    members: serverMembers,
    roles: serverRoles,
    joinedMember: serverMember,
    memberPresences,
    voiceChannelUsers,
  });

  deleteAllInboxCache(userId);
  const [userPresence] = await getUserPresences([userId]);
  userPresence && emitUserPresenceUpdateTo(serverId, userPresence);

  return [server, null] as const;
};

export const deleteServer = async (serverId: string) => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: { channels: { select: { id: true } } },
  });

  if (!server) {
    return [null, generateError('Server does not exist.')] as const;
  }

  await deleteAllInboxCacheInServer(serverId);
  await prisma.$transaction([
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
      })
    ),
  ]);

  await deleteServerChannelCaches(server.channels.map((channel) => channel.id));
  await deleteServerCache(serverId);

  emitServerLeft({
    serverId,
    serverDeleted: true,
  });

  Log.info(`Server (${server.name}) deleted.`);

  return [true, null] as const;
};

export const leaveServer = async (userId: string, serverId: string, ban = false, leaveMessage = true): Promise<CustomResult<boolean, CustomError>> => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: { channels: { select: { id: true } } },
  });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const isServerCreator = server.createdById === userId;

  if (isServerCreator) {
    return [null, generateError('You cannot leave your own server.')];
  }

  // check if user is in the server
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { serverId, userId } },
    include: { user: { select: { bot: true } } },
  });
  if (!member && !ban) {
    return [null, generateError('You are not in this server.')];
  }

  await deleteServerMemberCache(serverId, userId);
  if (!member && ban) {
    const isBanned = await prisma.bannedServerMember.findFirst({
      where: { serverId, userId },
    });
    if (isBanned) {
      return [null, generateError('User already banned.')];
    }
    await prisma.bannedServerMember.create({
      data: {
        id: generateId(),
        userId,
        serverId,
      },
    });
    deleteAllInboxCache(userId);
    return [true, null];
  }

  const transactions: any[] = [
    prisma.user.update({
      where: { id: userId },
      data: { servers: { disconnect: { id: serverId } } },
    }),
    prisma.serverMember.delete({
      where: { userId_serverId: { serverId: serverId, userId: userId } },
    }),
    prisma.messageMention.deleteMany({
      where: { serverId: serverId, mentionedToId: userId },
    }),
    prisma.serverChannelLastSeen.deleteMany({
      where: { serverId: serverId, userId: userId },
    }),
    prisma.userNotificationSettings.deleteMany({
      where: {
        OR: [{ serverId }, { channel: { serverId } }],
        userId: userId,
      },
    }),
  ];
  if (ban) {
    transactions.push(
      prisma.bannedServerMember.create({
        data: {
          id: generateId(),
          userId,
          serverId,
        },
      })
    );
  }
  await prisma.$transaction(transactions);

  await leaveVoiceChannel(userId);

  deleteAllInboxCache(userId);
  await removeServerIdFromAccountOrder(userId, serverId);
  if (server.systemChannelId && leaveMessage) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.LEAVE_SERVER,
      userId,
      serverId,
      updateLastSeen: false,
    });
  }

  emitServerLeft({
    userId,
    serverId,
    channelIds: server.channels.map((c) => c.id),
  });

  if (member?.user.bot) {
    const botRole = await prisma.serverRole.findFirst({
      where: { serverId, createdById: userId, botRole: true },
    });
    if (botRole) {
      await deleteServerRole(serverId, botRole.id, {
        forceDeleteBotRole: true,
      });
    }
  }

  return [false, null];
};

export const kickServerMember = async (userId: string, serverId: string) => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  if (server.createdById === userId) {
    return [null, generateError('You can not kick yourself.')];
  }

  const [, error] = await leaveServer(userId, serverId, false, true);
  if (error) return [null, error];

  if (server.systemChannelId) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.KICK_USER,
      userId,
      serverId,
      updateLastSeen: false,
    });
  }
  return [true, null];
};

export const serverMemberBans = async (serverId: string) => {
  return prisma.bannedServerMember.findMany({
    where: { serverId },
    select: { serverId: true, user: true },
  });
};
export const serverMemberRemoveBan = async (serverId: string, userId: string): Promise<CustomResult<boolean, CustomError>> => {
  const bannedMember = await prisma.bannedServerMember.findFirst({
    where: { serverId, userId },
  });
  if (!bannedMember) {
    return [null, generateError('This member is not banned.')];
  }
  await prisma.bannedServerMember.delete({ where: { id: bannedMember.id } });
  return [true, null];
};

export const banServerMember = async (userId: string, serverId: string, shouldDeleteRecentMessages?: boolean) => {
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

  const [, error] = await leaveServer(userId, serverId, true, false);
  if (error) return [null, error];

  if (shouldDeleteRecentMessages) {
    await deleteRecentUserServerMessages(userId, serverId);
  }

  if (server.systemChannelId) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.BAN_USER,
      userId,
      serverId,
      updateLastSeen: false,
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
}

export const updateServer = async (serverId: string, update: UpdateServerOptions): Promise<CustomResult<UpdateServerOptions, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if channel is a server channel
  if (update.defaultChannelId) {
    const channel = await prisma.channel.findFirst({
      where: { id: update.defaultChannelId },
    });
    if (!channel || channel.serverId !== serverId) {
      return [null, generateError('Invalid defaultChannelId')];
    }
  }
  if (update.systemChannelId) {
    const channel = await prisma.channel.findFirst({
      where: { id: update.systemChannelId },
    });
    if (!channel || channel.serverId !== serverId) {
      return [null, generateError('Invalid systemChannelId')];
    }
  }

  if (update.avatar) {
    const [data, error] = await nerimityCDN.uploadAvatar({
      base64: update.avatar,
      uniqueId: serverId,
    });
    if (error) return [null, generateError(error)];
    if (data) {
      update.avatar = data.path;
    }
  }

  if (update.banner) {
    const [data, error] = await nerimityCDN.uploadBanner(update.banner, serverId);
    if (error) return [null, generateError(error)];
    if (data) {
      update.banner = data.path;
    }
  }

  if (update.name && update.name?.trim() !== server.name.trim()) {
    update.verified = false;
  }

  await prisma.server.update({ where: { id: serverId }, data: update });
  emitServerUpdated(serverId, update);
  return [update, null];
};

interface AddServerEmojiOpts {
  name: string;
  serverId: string;
  uploadedById: string;
  base64: string;
}

async function hasReachedMaxServerEmojis(serverId?: string) {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    select: { verified: true },
  });
  if (!server) return true;

  const emojiCount = await prisma.customEmoji.count({ where: { serverId } });
  if (server.verified) {
    return emojiCount >= 100;
  }
  return emojiCount >= 50;
}

export const addServerEmoji = async (opts: AddServerEmojiOpts) => {
  if (await hasReachedMaxServerEmojis(opts.serverId)) return [null, 'You have reached the maximum number of emojis for this server.'] as const;
  const [data, error] = await nerimityCDN.uploadEmoji(opts.base64, opts.serverId);
  if (error) return [null, generateError(error)] as const;

  opts.name = opts.name.replace(/[^0-9a-zA-Z]/g, '_');

  const result = await prisma.customEmoji.create({
    data: {
      id: data!.id,
      name: opts.name,
      gif: data!.gif || false,
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

export const updateServerFolder = async (userId: string, folderId: string, serverIds: string[]) => {
  const folder = await prisma.serverFolder.findUnique({ where: { id: folderId } });
  if (!folder) {
    return [null, generateError('Folder not found.')] as const;
  }
  const isAlreadyInFolder = await prisma.serverFolder.findFirst({ where: { id: { not: folderId }, createdById: userId, serverIds: { hasSome: serverIds } } });

  if (isAlreadyInFolder) {
    return [null, generateError('Server is already in a folder.')] as const;
  }

  const isInServers = await prisma.serverMember.count({ where: { userId, serverId: { in: serverIds } } });

  if (isInServers !== serverIds.length) {
    return [null, generateError('Some servers are not joined.')] as const;
  }

  await prisma.serverFolder.update({
    where: { id: folderId },
    data: {
      serverIds,
    },
  });

  emitServerFolderUpdated(userId, { id: folderId, serverIds });

  return [true, null] as const;
};
export const createServerFolder = async (userId: string, serverIds: string[]) => {
  if (serverIds.length !== 2) {
    return [null, generateError('serverIds must be an array of length 2.')] as const;
  }
  const isAlreadyInFolder = await prisma.serverFolder.findFirst({ where: { createdById: userId, serverIds: { hasSome: serverIds } } });

  if (isAlreadyInFolder) {
    return [null, generateError('Server is already in a folder.')] as const;
  }

  const isInServers = await prisma.serverMember.count({ where: { userId, serverId: { in: serverIds } } });

  if (isInServers !== serverIds.length) {
    return [null, generateError('Some servers are not joined.')] as const;
  }

  const newFolderId = generateId();

  const account = await prisma.account.findUnique({ where: { userId }, select: { serverOrderIds: true } });
  const serverOrderIds = account?.serverOrderIds ?? [];

  const serverIndex = serverOrderIds.findIndex((serverId) => serverIds[0] === serverId);
  if (serverIndex === -1) {
    return [null, generateError('Server not found. Try re-ordering the servers.')] as const;
  }

  // insert folder Id at index serverIndex
  serverOrderIds.splice(serverIndex, 0, newFolderId);

  await prisma.$transaction([
    prisma.account.update({ where: { userId }, data: { serverOrderIds } }),
    prisma.serverFolder.create({
      data: {
        id: newFolderId,
        serverIds,
        createdById: userId,
      },
    }),
  ]);
  emitServerOrderUpdated(userId, serverOrderIds);
  emitServerFolderCreated(userId, { id: newFolderId, serverIds });

  return [newFolderId, null] as const;
};

export const updateServerOrder = async (userId: string, orderedServerIds: string[]) => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { servers: { select: { id: true } }, serverFolders: { select: { id: true } } },
  });

  if (!user) {
    return [null, generateError('User does not exist.')];
  }

  const joinedServerIds = user.servers.map((server) => server.id);
  const serverFolderIds = user.serverFolders.map((folder) => folder.id);
  const combinedIds = [...joinedServerIds, ...serverFolderIds];

  if (combinedIds.length !== orderedServerIds.length) {
    return [null, generateError('Server order length does not match.')];
  }

  const doesNotExist = combinedIds.find((id) => !orderedServerIds.includes(id));

  if (doesNotExist) {
    return [null, generateError('Invalid server/folder ids.')];
  }

  await prisma.account.update({
    where: { userId },
    data: {
      serverOrderIds: orderedServerIds,
    },
  });

  emitServerOrderUpdated(userId, orderedServerIds);

  return [{ success: true }, null];
};

export const updateServerEmoji = async (serverId: string, emojiId: string, newName: string) => {
  const emoji = await prisma.customEmoji.findFirst({
    where: { id: emojiId, serverId },
  });
  if (!emoji) return [null, 'Emoji not found.'] as const;

  newName = newName.trim().replace(/[^0-9a-zA-Z]/g, '_');

  const newEmoji = await prisma.customEmoji.update({
    where: { id: emojiId },
    data: { name: newName },
  });
  emitServerEmojiUpdate(serverId, emojiId, newName);
  return [newEmoji, null] as const;
};

export const deleteServerEmoji = async (serverId: string, emojiId: string) => {
  const emoji = await prisma.customEmoji.findFirst({
    where: { id: emojiId, serverId },
  });
  if (!emoji) return [null, 'Emoji not found.'] as const;

  await prisma.customEmoji.delete({ where: { id: emoji.id } });
  await nerimityCDN.deleteImage('emojis/' + emoji.id + (emoji.gif ? '.gif' : '.webp'));
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
      })
    )
  );

  if (opts.categoryId) {
    const category = channels[opts.categoryId]!;
    const isPrivateCategory = hasBit(category.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    isPrivateCategory && (await makeChannelsInCategoryPrivate(opts.categoryId, opts.serverId));
  }

  const payload = {
    categoryId: opts.categoryId,
    orderedChannelIds: opts.orderedChannelIds,
  };

  emitServerChannelOrderUpdated(opts.serverId, payload);
  return [payload, null] as const;
}

export const getPublicServerFromEmoji = async (emojiId: string) => {
  const emoji = await prisma.customEmoji.findFirst({
    where: { id: emojiId },
  });

  if (!emoji) return [null, generateError('Emoji not found.')] as const;

  return getPublicServer(emoji.serverId);
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
      })
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
