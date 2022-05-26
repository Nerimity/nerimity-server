import { MESSAGE_CREATED, MESSAGE_DELETED, SERVER_JOINED, SERVER_MEMBER_JOINED } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';
import { Channel } from '../models/ChannelModel';
import { ServerMember } from '../models/ServerMemberModel';
import { Server } from '../models/ServerModel';
import { Message } from '../models/MessageModel';
import { User } from '../models/UserModel';
import { UserCache } from '../cache/UserCache';

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

  
  io.in(joinedMemberUserId).emit(SERVER_JOINED, {
    server: opts.server,
    members: opts.members,
    channels: opts.channels,
  });
};

export const emitServerMessageCreated = (serverId: string, message: Omit<Message, 'createdBy'> &  {createdBy: UserCache}, excludeSocketId?: string) => {
  const io = getIO();

  if (excludeSocketId) {
    io.in(serverId).except(excludeSocketId).emit(MESSAGE_CREATED, message);
    return;
  }

  io.in(serverId).emit(MESSAGE_CREATED, message);
};

export const emitServerMessageDeleted = (serverId: string, data: {channelId: string, messageId: string}) => {
  const io = getIO();

  io.in(serverId).emit(MESSAGE_DELETED, data);
};