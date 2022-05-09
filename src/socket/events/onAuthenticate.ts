import { Socket } from 'socket.io';
import { addSocketUser, authenticateUser, getUserPresences } from '../../cache/UserCache';
import { AUTHENTICATED } from '../../common/ClientEventNames';
import { removeDuplicates } from '../../common/utils';
import { emitError } from '../../emits/Connection';
import { UserModel } from '../../models/UserModel';
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
  const cacheUser = accountCache.user;
  socket.join(accountCache.user._id);

  const user = await UserModel.findOne({ _id: accountCache.user._id }).select('status');
  if (!user) {
    emitError(socket, { message: 'User not found.', disconnect: true });
    return;
  }
  const {servers, serverChannels, serverMembers} = await getServers(cacheUser._id);

  // join room
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    socket.join(server._id.toString());
  }
  
  const isFirstConnect = await addSocketUser(cacheUser._id, socket.id, {
    status: user.status,
    userId: cacheUser._id
  });

  const userIds = removeDuplicates(serverMembers.map(member => member.user._id.toString()));

  const presences = await getUserPresences(userIds);

  console.log('isFirstConnect', isFirstConnect);



  socket.emit(AUTHENTICATED, {
    user: cacheUser,
    servers,
    serverMembers,
    presences,
    channels: serverChannels,
  });
}