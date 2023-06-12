import { Channel, Server } from '@prisma/client';
import { getUserPresences } from '../cache/UserCache';
import { CustomResult } from '../common/CustomResult';
import {
  exists,
  prisma,
  removeServerIdFromAccountOrder,
} from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import {
  CHANNEL_PERMISSIONS,
  ROLE_PERMISSIONS,
  hasBit,
} from '../common/Bitwise';
import { generateHexColor } from '../common/random';
import {
  emitServerChannelOrderUpdated,
  emitServerEmojiAdd,
  emitServerEmojiRemove,
  emitServerEmojiUpdate,
  emitServerJoined,
  emitServerLeft,
  emitServerOrderUpdated,
  emitServerUpdated,
} from '../emits/Server';
import { ChannelType } from '../types/Channel';
import { createMessage, deleteRecentMessages } from './Message';
import { MessageType } from '../types/Message';
import { emitUserPresenceUpdateTo } from '../emits/User';
import * as nerimityCDN from '../common/nerimityCDN';
import { prependOnceListener } from 'process';
import { makeChannelsInCategoryPrivate } from './Channel';

interface CreateServerOptions {
  name: string;
  creatorId: string;
}

export const hasReachedMaxServers = async (
  userId: string
): Promise<boolean> => {
  const serverCount = await prisma.server.count({
    where: { createdById: userId },
  });
  return serverCount > 100;
};

export const createServer = async (
  opts: CreateServerOptions
): Promise<CustomResult<Server, CustomError>> => {
  const maxServersReached = await hasReachedMaxServers(opts.creatorId);
  if (maxServersReached) {
    return [
      null,
      generateError('You have reached the maximum number of servers.'),
    ];
  }

  const serverId = generateId();
  const channelId = generateId();
  const serverMemberId = generateId();
  const roleId = generateId();

  const [server, defaultRole, channel, user, serverMember] =
    await prisma.$transaction([
      prisma.server.create({
        data: {
          id: serverId,
          name: opts.name.trim(),
          createdById: opts.creatorId,
          defaultChannelId: channelId,
          systemChannelId: channelId,
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
          permissions: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
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
    ]);

  emitServerJoined({
    server: server,
    channels: [channel],
    members: [serverMember],
    roles: [defaultRole],
    joinedMember: serverMember,
    memberPresences: [],
  });
  return [server, null];
};

export const getServers = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      servers: {
        include: {
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

  const [serverChannels, serverMembers, serverRoles, serverSettings] =
    await prisma.$transaction([
      prisma.channel.findMany({
        where: { serverId: { in: serverIds } },
        include: { _count: { select: { attachments: true } } },
      }),
      prisma.serverMember.findMany({
        where: { serverId: { in: serverIds } },
        include: { user: true },
      }),
      prisma.serverRole.findMany({ where: { serverId: { in: serverIds } } }),
      prisma.serverMemberSettings.findMany({
        where: { userId },
        select: { serverId: true, notificationSoundMode: true },
      }),
    ]);

  return {
    servers: user?.servers || [],
    serverChannels,
    serverMembers,
    serverRoles,
    serverSettings,
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
  serverId: string
): Promise<CustomResult<Server, CustomError>> => {
  const maxServersReached = await hasReachedMaxServers(userId);
  if (maxServersReached) {
    return [
      null,
      generateError('You have reached the maximum number of servers.'),
    ];
  }

  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: {
      customEmojis: {
        select: { gif: true, id: true, name: true },
      },
    },
  });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if user is already in server
  const isInServer = await exists(prisma.serverMember, {
    where: { serverId, userId },
  });
  if (isInServer) {
    return [null, generateError('You are already in this server.')];
  }

  const isBanned = await exists(prisma.bannedServerMember, {
    where: { serverId, userId },
  });

  if (isBanned) {
    return [null, generateError('You are banned from this server')];
  }

  if (server.systemChannelId) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.JOIN_SERVER,
      serverId: serverId,
      userId: userId,
    });
  }

  const [_, serverRoles, serverMember, serverChannels, serverMembers] =
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { servers: { connect: { id: serverId } } },
      }),
      prisma.serverRole.findMany({ where: { serverId } }),
      prisma.serverMember.create({
        data: { id: generateId(), serverId, userId },
        include: { user: true },
      }),
      prisma.channel.findMany({
        where: { serverId: server.id },
        include: { _count: { select: { attachments: true } } },
      }),
      prisma.serverMember.findMany({
        where: { serverId: server.id },
        include: { user: true },
      }),
    ]);

  const memberIds = serverMembers.map((sm) => sm.user.id);
  const memberPresences = await getUserPresences(memberIds);

  emitServerJoined({
    server: server,
    channels: serverChannels,
    members: serverMembers,
    roles: serverRoles,
    joinedMember: serverMember,
    memberPresences,
  });

  const [userPresence] = await getUserPresences([userId]);
  userPresence && emitUserPresenceUpdateTo(serverId, userPresence);

  return [server, null];
};

export const deleteOrLeaveServer = async (
  userId: string,
  serverId: string,
  ban = false,
  leaveMessage = true
): Promise<CustomResult<boolean, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const isServerCreator = server.createdById === userId;

  // check if user is in the server
  const isInServer = await exists(prisma.serverMember, {
    where: { serverId, userId },
  });
  if (!isInServer && !ban) {
    return [null, generateError('You are not in this server.')];
  }

  if (!isInServer && ban) {
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
    return [true, null];
  }

  if (isServerCreator) {
    // This one line also deletes related stuff from the database.
    await prisma.server.delete({ where: { id: serverId } });
  } else {
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
      prisma.serverMemberSettings.deleteMany({
        where: { serverId: serverId, userId: userId },
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

    if (server.systemChannelId && leaveMessage) {
      await createMessage({
        channelId: server.systemChannelId,
        type: MessageType.LEAVE_SERVER,
        userId,
        serverId,
        updateLastSeen: false,
      });
    }
  }
  await removeServerIdFromAccountOrder(userId, serverId);
  emitServerLeft(userId, serverId, isServerCreator);

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

  const [, error] = await deleteOrLeaveServer(userId, serverId, false, true);
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
export const serverMemberRemoveBan = async (
  serverId: string,
  userId: string
): Promise<CustomResult<boolean, CustomError>> => {
  const bannedMember = await prisma.bannedServerMember.findFirst({
    where: { serverId, userId },
  });
  if (!bannedMember) {
    return [null, generateError('This member is not banned.')];
  }
  await prisma.bannedServerMember.delete({ where: { id: bannedMember.id } });
  return [true, null];
};

export const banServerMember = async (
  userId: string,
  serverId: string,
  shouldDeleteRecentMessages?: boolean
) => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  if (server.createdById === userId) {
    return [null, generateError('You can not kick yourself.')];
  }

  const userToBan = await prisma.user.findFirst({
    where: { id: userId },
    select: { id: true },
  });
  if (!userToBan) {
    return [null, generateError('Invalid userId')];
  }

  const [, error] = await deleteOrLeaveServer(userId, serverId, true, false);
  if (error) return [null, error];

  if (shouldDeleteRecentMessages) {
    await deleteRecentMessages(userId, serverId);
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

export const updateServer = async (
  serverId: string,
  update: UpdateServerOptions
): Promise<CustomResult<UpdateServerOptions, CustomError>> => {
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
    const [data, error] = await nerimityCDN.uploadAvatar(
      update.avatar,
      serverId
    );
    if (error) return [null, generateError(error)];
    if (data) {
      update.avatar = data.path;
    }
  }

  if (update.banner) {
    const [data, error] = await nerimityCDN.uploadBanner(
      update.banner,
      serverId
    );
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
  const emojiCount = await prisma.customEmoji.count({ where: { serverId } });
  return emojiCount > 30;
}

export const addServerEmoji = async (opts: AddServerEmojiOpts) => {
  if (await hasReachedMaxServerEmojis(opts.serverId))
    return [
      null,
      'You have reached the maximum number of emojis for this server.',
    ] as const;
  const [data, error] = await nerimityCDN.uploadEmoji(
    opts.base64,
    opts.serverId
  );
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

export const updateServerOrder = async (
  userId: string,
  orderedServerIds: string[]
) => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { servers: { select: { id: true } } },
  });

  if (!user) {
    return [null, generateError('User does not exist.')];
  }

  const joinedServerIds = user.servers.map((server) => server.id);
  if (joinedServerIds.length !== orderedServerIds.length) {
    return [null, generateError('Server order length does not match.')];
  }

  const doesNotExist = joinedServerIds.find(
    (id) => !orderedServerIds.includes(id)
  );

  if (doesNotExist) {
    return [null, generateError('Invalid server ids.')];
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

export const updateServerEmoji = async (
  serverId: string,
  emojiId: string,
  newName: string
) => {
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
  await nerimityCDN.deleteImage(
    'emojis/' + emoji.id + (emoji.gif ? '.gif' : '.webp')
  );
  emitServerEmojiRemove(serverId, emojiId);
  return [true, null] as const;
};

interface UpdateServerChannelOrderOpts {
  serverId: string;
  categoryId?: string;
  orderedChannelIds: string[];
}

// TODO: make orderChannelIds cant contain a channel type of category when categoryId is provided.
export async function updateServerChannelOrder(
  opts: UpdateServerChannelOrderOpts
) {
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
          ...(opts.orderedChannelIds.includes(channel.id)
            ? { order: opts.orderedChannelIds.indexOf(channel.id) + 1 }
            : undefined),

          // update or add categoryId
          ...(opts.categoryId &&
          opts.categoryId !== channel.categoryId &&
          opts.orderedChannelIds.includes(channel.id)
            ? {
                categoryId: opts.categoryId,
              }
            : undefined),
          // remove categoryId
          ...(!opts.categoryId &&
          channel.categoryId &&
          opts.orderedChannelIds.includes(channel.id)
            ? {
                categoryId: null,
              }
            : undefined),
        },
      })
    )
  );

  if (opts.categoryId) {
    const category = channels[opts.categoryId];
    const isPrivateCategory = hasBit(
      category.permissions || 0,
      CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit
    );
    isPrivateCategory &&
      (await makeChannelsInCategoryPrivate(opts.categoryId, opts.serverId));
  }

  const payload = {
    categoryId: opts.categoryId,
    orderedChannelIds: opts.orderedChannelIds,
  };

  emitServerChannelOrderUpdated(opts.serverId, payload);
  return [payload, null] as const;
}
