import { MESSAGE_CREATED, MESSAGE_DELETED, SERVER_JOINED, SERVER_LEFT, SERVER_MEMBER_JOINED, SERVER_MEMBER_LEFT, SERVER_MEMBER_UPDATED, SERVER_ROLE_CREATED, SERVER_ROLE_UPDATED, SERVER_UPDATED } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';
import { UserCache } from '../cache/UserCache';
import { UpdateServerOptions } from '../services/Server';
import { CHANNEL_PERMISSIONS, hasPermission } from '../common/Permissions';
import { Channel, Message, Server, ServerMember, ServerRole, User } from '@prisma/client';
import { UpdateServerRoleOptions } from '../services/ServerRole';
import { UpdateServerMember } from '../services/ServerMember';

interface ServerJoinOpts {
  server: Server;
  members: Partial<ServerMember>[];
  channels: Channel[];
  joinedMember: ServerMember & {user: User};
  roles: ServerRole[]
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
    const channel = opts.channels[i];

    const isPrivateChannel = hasPermission(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    const isAdmin = opts.server.createdById === joinedMemberUserId;

    if (isPrivateChannel && !isAdmin) continue;
    getIO().in(joinedMemberUserId).socketsJoin(channel.id);
    
  }



  
  io.in(joinedMemberUserId).emit(SERVER_JOINED, {
    server: opts.server,
    members: opts.members,
    channels: opts.channels,
    roles: opts.roles
  });
};


export const emitServerLeft = (userId: string, serverId: string, serverDeleted: boolean) => {
  const io = getIO();

  if (serverDeleted) {
    io.in(serverId).emit(SERVER_LEFT, {
      serverId: serverId,
    });
    io.in(serverId).socketsLeave(serverId);
    return;
  }


  io.in(userId).socketsLeave(serverId);
  io.in(serverId).emit(SERVER_MEMBER_LEFT, {
    serverId: serverId,
    userId: userId,
  });

  io.in(userId).emit(SERVER_LEFT, {
    serverId: serverId,
  });

};



export const emitServerMessageCreated = (message: Message & {createdBy: Partial<UserCache | User>}, excludeSocketId?: string) => {
  const io = getIO();

  const channelId = message.channelId;

  if (excludeSocketId) {
    io.in(channelId).except(excludeSocketId).emit(MESSAGE_CREATED, message);
    return;
  }

  io.in(channelId).emit(MESSAGE_CREATED, message);
};

export const emitServerMessageDeleted = (data: {channelId: string, messageId: string}) => {
  const io = getIO();

  io.in(data.channelId).emit(MESSAGE_DELETED, data);
};


export const emitServerUpdated = (serverId: string, updated: UpdateServerOptions) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_UPDATED, {serverId, updated});
};
export const emitServerMemberUpdated = (serverId: string, userId: string, updated: UpdateServerMember) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_MEMBER_UPDATED, {serverId, userId, updated});
};

export const emitServerRoleCreated = (serverId: string, role: ServerRole) => {
  const io = getIO();
  io.in(serverId).emit(SERVER_ROLE_CREATED, role);
};

export const emitServerRoleUpdated = (serverId: string, roleId: string, updated: UpdateServerRoleOptions) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_ROLE_UPDATED, {serverId, roleId, updated});
};
