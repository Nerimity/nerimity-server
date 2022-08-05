import { MESSAGE_CREATED, MESSAGE_DELETED, SERVER_JOINED, SERVER_MEMBER_JOINED, SERVER_UPDATED } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';
import { Channel } from '../models/ChannelModel';
import { ServerMember } from '../models/ServerMemberModel';
import { Server } from '../models/ServerModel';
import { Message } from '../models/MessageModel';
import { UserCache } from '../cache/UserCache';
import { UpdateServerOptions } from '../services/Server';
import { CHANNEL_PERMISSIONS, hasPermission } from '../common/Permissions';

interface ServerJoinOpts {
  server: Server;
  members: Partial<ServerMember>[];
  channels: Channel[];
  joinedMember: Partial<ServerMember>;
}

export const emitServerJoined = (opts: ServerJoinOpts) => {
  const io = getIO();
  const serverId = opts.server._id.toString();
  if (!opts.joinedMember?.user?._id) throw new Error('User not found.');
  const joinedMemberUserId = opts.joinedMember.user._id.toString();

  io.to(serverId).emit(SERVER_MEMBER_JOINED, {
    serverId: serverId,
    member: opts.joinedMember,
  });
  
  io.in(joinedMemberUserId).socketsJoin(serverId);

  for (let i = 0; i < opts.channels.length; i++) {
    const channel = opts.channels[i];

    const isPrivateChannel = hasPermission(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    const isAdmin = opts.server.createdBy?.equals(joinedMemberUserId);

    if (isPrivateChannel && !isAdmin) continue;
    getIO().in(joinedMemberUserId).socketsJoin(channel._id.toString());
    
  }



  
  io.in(joinedMemberUserId).emit(SERVER_JOINED, {
    server: opts.server,
    members: opts.members,
    channels: opts.channels,
  });
};

export const emitServerMessageCreated = (message: Omit<Message, 'createdBy'> &  {createdBy: UserCache}, excludeSocketId?: string) => {
  const io = getIO();

  const channelId = message.channel._id.toString();

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
