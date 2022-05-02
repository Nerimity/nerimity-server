import { Socket } from 'socket.io';
import { authenticateUser } from '../../cache/UserCache';
import { AUTHENTICATED } from '../../common/ClientEventNames';
import { emitError } from '../../emits/Connection';
import { getServers } from '../../services/Server';

interface Payload {
  token: string;
}

export async function onAuthenticate(socket: Socket, payload: Payload) {
  const [accountCache, error] = await authenticateUser(payload.token);
  if (error !== null) {
    emitError(socket, { message: error, disconnect: true });
    return;
  }
  socket.join(accountCache.user._id);

  const {servers, serverChannels, serverMembers} = await getServers(accountCache.user._id);

  // join room
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    socket.join(server._id.toString());
  }


  socket.emit(AUTHENTICATED, {
    user: accountCache?.user,
    servers,
    serverMembers,
    channels: serverChannels,
  });
}