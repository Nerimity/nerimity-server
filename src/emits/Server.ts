import { MESSAGE_CREATED, MESSAGE_DELETED, MESSAGE_DELETED_BATCH, MESSAGE_REACTION_ADDED, MESSAGE_REACTION_REMOVED, MESSAGE_UPDATED, SERVER_CHANNEL_ORDER_UPDATED, SERVER_CHANNEL_PERMISSIONS_UPDATED, SERVER_EMOJI_ADD, SERVER_EMOJI_REMOVE, SERVER_EMOJI_UPDATE, SERVER_JOINED, SERVER_LEFT, SERVER_MEMBER_JOINED, SERVER_MEMBER_LEFT, SERVER_MEMBER_UPDATED, SERVER_ORDER_UPDATED, SERVER_ROLE_CREATED, SERVER_ROLE_DELETED, SERVER_ROLE_ORDER_UPDATED, SERVER_ROLE_UPDATED, SERVER_UPDATED } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';
import { Presence, UserCache } from '../cache/UserCache';
import { UpdateServerOptions } from '../services/Server';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, addBit, hasBit } from '../common/Bitwise';
import { Channel, CustomEmoji, Message, Server, ServerChannelPermissions, ServerMember, ServerRole, User } from '@prisma/client';
import { UpdateServerRoleOptions } from '../services/ServerRole';
import { UpdateServerMember } from '../services/ServerMember';
import { VoiceCacheFormatted } from '../cache/VoiceCache';
import { serverMemberHasPermission } from '../common/serverMembeHasPermission';
import { Prisma } from '@prisma/client';
import { publicUserExcludeFields } from '../common/database';

const partialMember = Prisma.validator<Prisma.ServerMemberDefaultArgs>()({
  include: { user: { select: publicUserExcludeFields } },
});

type PartialMember = Prisma.ServerMemberGetPayload<typeof partialMember>;

interface ServerJoinOpts {
  server: Server;
  members: PartialMember[];
  channels: (Channel & { permissions: { permissions: number | null; roleId: string }[] })[];
  joinedMember: PartialMember;
  roles: ServerRole[];
  memberPresences: Presence[];
  voiceChannelUsers: VoiceCacheFormatted[];
}

export const emitServerJoined = (opts: ServerJoinOpts) => {
  const io = getIO();
  const serverId = opts.server.id;
  if (!opts.joinedMember?.user.id) throw new Error('User not found.');
  const joinedMemberUserId = opts.joinedMember.user.id;

  io.to(serverId).emit(SERVER_MEMBER_JOINED, {
    serverId: serverId,
    member: opts.joinedMember,
  });

  io.in(joinedMemberUserId).socketsJoin(serverId);

  for (let i = 0; i < opts.channels.length; i++) {
    const channel = opts.channels[i]!;
    const isCreator = opts.server.createdById === joinedMemberUserId;

    if (isCreator) {
      io.in(joinedMemberUserId).socketsJoin(channel.id);
      continue;
    }

    let memberChannelPermissions = 0;

    for (let y = 0; y < channel.permissions.length; y++) {
      const permissions = channel.permissions[y];
      memberChannelPermissions = addBit(memberChannelPermissions, permissions?.permissions || 0);
    }

    const isPrivateChannel = hasBit(memberChannelPermissions, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    if (!isPrivateChannel) {
      io.in(joinedMemberUserId).socketsJoin(channel.id);
      continue;
    }

    const hasPermission = serverMemberHasPermission({
      permission: ROLE_PERMISSIONS.ADMIN,
      member: opts.members.find((member) => member.user.id === joinedMemberUserId && member.serverId === opts.server.id)!,
      serverRoles: opts.roles,
      defaultRoleId: opts.server.defaultRoleId,
    });
    if (!hasPermission) continue;

    getIO().in(joinedMemberUserId).socketsJoin(channel.id);
  }

  io.in(joinedMemberUserId).emit(SERVER_JOINED, {
    server: opts.server,
    members: opts.members,
    channels: opts.channels,
    roles: opts.roles,
    memberPresences: opts.memberPresences,
    voiceChannelUsers: opts.voiceChannelUsers,
  });
};

export const emitServerLeft = (opts: { userId?: string; serverId: string; serverDeleted?: boolean; channelIds?: string[] }) => {
  const io = getIO();

  if (opts.serverDeleted) {
    io.in(opts.serverId).emit(SERVER_LEFT, {
      serverId: opts.serverId,
    });
    io.in(opts.serverId).socketsLeave(opts.serverId);
    return;
  }

  if (!opts.userId || !opts.channelIds) return;

  io.in(opts.userId).socketsLeave([opts.serverId, ...opts.channelIds]);
  io.in(opts.serverId).emit(SERVER_MEMBER_LEFT, {
    serverId: opts.serverId,
    userId: opts.userId,
  });

  io.in(opts.userId).emit(SERVER_LEFT, {
    serverId: opts.serverId,
  });
};

export const emitServerMessageCreated = (message: Message & { createdBy: Partial<UserCache | User> }, socketId?: string) => {
  const io = getIO();

  const channelId = message.channelId;

  if (socketId) {
    io.in(channelId).except(socketId).emit(MESSAGE_CREATED, { message });
    io.in(socketId).emit(MESSAGE_CREATED, { socketId, message });
    return;
  }

  io.in(channelId).emit(MESSAGE_CREATED, { socketId, message });
};

export const emitServerMessageUpdated = (channelId: string, messageId: string, updated: Partial<Message>) => {
  const io = getIO();

  io.in(channelId).emit(MESSAGE_UPDATED, { channelId, messageId, updated });
};

export const emitServerMessageReactionAdded = (channelId: string, reaction: any) => {
  const io = getIO();

  io.in(channelId).emit(MESSAGE_REACTION_ADDED, reaction);
};

export const emitServerMessageReactionRemoved = (channelId: string, reaction: any) => {
  const io = getIO();

  io.in(channelId).emit(MESSAGE_REACTION_REMOVED, reaction);
};

export const emitServerMessageDeleted = (data: { channelId: string; messageId: string }) => {
  const io = getIO();

  io.in(data.channelId).emit(MESSAGE_DELETED, data);
};

export const emitServerMessageDeletedBatch = (data: { userId: string; serverId: string; fromTime: Date; toTime: Date }) => {
  const io = getIO();

  io.in(data.serverId).emit(MESSAGE_DELETED_BATCH, {
    userId: data.userId,
    fromTime: data.fromTime.getTime(),
    serverId: data.serverId,
    toTime: data.toTime.getTime(),
  });
};

export const emitServerUpdated = (serverId: string, updated: UpdateServerOptions) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_UPDATED, { serverId, updated });
};

export const emitServerEmojiAdd = (serverId: string, emoji: CustomEmoji) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_EMOJI_ADD, { serverId, emoji });
};

export const emitServerEmojiRemove = (serverId: string, emojiId: string) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_EMOJI_REMOVE, { serverId, emojiId });
};
export const emitServerEmojiUpdate = (serverId: string, emojiId: string, name: string) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_EMOJI_UPDATE, { serverId, emojiId, name });
};

export const emitServerMemberUpdated = (serverId: string, userId: string, updated: UpdateServerMember) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_MEMBER_UPDATED, { serverId, userId, updated });
};

export const emitServerRoleCreated = (serverId: string, role: ServerRole) => {
  const io = getIO();
  io.in(serverId).emit(SERVER_ROLE_CREATED, role);
};

export const emitServerRoleUpdated = (serverId: string, roleId: string, updated: UpdateServerRoleOptions) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_ROLE_UPDATED, { serverId, roleId, updated });
};

export const emitServerRoleOrderUpdated = (serverId: string, roleIds: string[]) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_ROLE_ORDER_UPDATED, { serverId, roleIds });
};

export const emitServerChannelOrderUpdated = (serverId: string, updated: { categoryId?: string; orderedChannelIds: string[] }) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_CHANNEL_ORDER_UPDATED, { serverId, ...updated });
};

export const emitServerChannelPermissionsUpdated = (serverId: string, updated: Partial<ServerChannelPermissions>) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_CHANNEL_PERMISSIONS_UPDATED, updated);
};

export const emitServerOrderUpdated = (userId: string, serverIds: string[]) => {
  const io = getIO();

  io.in(userId).emit(SERVER_ORDER_UPDATED, { serverIds });
};

export const emitServerRoleDeleted = (serverId: string, roleId: string) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_ROLE_DELETED, { serverId, roleId });
};
