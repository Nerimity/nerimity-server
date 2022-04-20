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

  const {servers, serverChannels, serverMembers} = await getServers(accountCache.user._id);

  socket.emit(AUTHENTICATED, {
    user: accountCache.user,
    servers,
    serverChannels,
    serverMembers,
  });
}