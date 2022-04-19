import { Socket } from 'socket.io';
import { authenticateUser } from '../../cache/UserCache';
import { AUTHENTICATED } from '../../common/ClientEventNames';
import { emitError } from '../../emits/Connection';
import { ChannelModel } from '../../models/ChannelModel';
import { ServerMemberModel } from '../../models/ServerMemberModel';
import { Server } from '../../models/ServerModel';
import { UserModel } from '../../models/UserModel';

interface Payload {
  token: string;
}

export async function onAuthenticate(socket: Socket, payload: Payload) {
  const [accountCache, error] = await authenticateUser(payload.token);
  if (error !== null) {
    emitError(socket, { message: error, disconnect: true });
    return;
  }

  const user = await UserModel.findById(accountCache.user._id).select('servers').populate<{servers: Server[]}>('servers');
  const serverChannels = await ChannelModel.find({server: {$in: user?.servers}});
  const serverMembers = await ServerMemberModel.find({server: {$in: user?.servers}}).populate('user');

  socket.emit(AUTHENTICATED, {
    user: accountCache.user,
    servers: user?.servers,
    serverChannels: serverChannels,
    serverMembers: serverMembers,
  });
}