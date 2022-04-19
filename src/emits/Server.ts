import { SERVER_JOIN } from '../common/ClientEventNames';
import { getIO } from '../common/socket';
import { Channel } from '../models/ChannelModel';
import { ServerMember } from '../models/ServerMemberModel';
import { Server } from '../models/ServerModel';

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