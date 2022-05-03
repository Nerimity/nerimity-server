import { MESSAGE_CREATED, MESSAGE_DELETED, SERVER_JOIN } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';
import { Channel } from '../models/ChannelModel';
import { ServerMember } from '../models/ServerMemberModel';
import { Server } from '../models/ServerModel';
import { Message } from '../models/MessageModel';

interface ServerJoinOpts {
  server: Server;
  members: ServerMember[];
  channels: Channel[];
  joinedMember: ServerMember;
}

export const emitServerJoin = (opts: ServerJoinOpts) => {
  const io = getIO();
  const serverId = opts.server._id.toString();
  const joinedMemberId = opts.joinedMember._id.toString();

  io.in(joinedMemberId).socketsJoin(serverId);

  io.in(serverId).emit(SERVER_JOIN, {
    server: opts.server,
    members: opts.members,
    channels: opts.channels,
  });
};

export const emitServerMessageCreated = (serverId: string, message: Message, excludeSocketId?: string) => {
  const io = getIO();

  if (excludeSocketId) {
    io.in(serverId).except(excludeSocketId).emit(MESSAGE_CREATED, message);
    return;
  }

  io.in(serverId).emit(MESSAGE_CREATED, message);
};

export const emitServerMessageDeleted = (serverId: string, messageId: string) => {
  const io = getIO();

  io.in(serverId).emit(MESSAGE_DELETED, {_id: messageId});
};