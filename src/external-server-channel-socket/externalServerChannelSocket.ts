import * as socketIO from 'socket.io';
import { decryptToken } from '../common/JWT';
import env from '../common/env';
import { getIO } from '../socket/socket';
import { getExternalServerChannel } from '../services/ExternalServerChannel';

interface GetMessagesPayload {
  name: 'get_messages';
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
}

type Payload = GetMessagesPayload;

let externalServerChannelIo: socketIO.Namespace;

export async function createExternalServerClientIo() {
  externalServerChannelIo = getIO().of('/external-server-channel');

  externalServerChannelIo.on('connection', (socket) => {
    let authenticateRan = false;

    socket.on('authenticate', async (payload) => {
      if (authenticateRan) return;
      authenticateRan = true;
      onAuthenticate(socket, payload);
    });
  });
}

async function onAuthenticate(socket: socketIO.Socket, payload: { version: string; token: string }) {
  let authenticated = false;
  const tokenData = decryptToken(payload.token, env.JWT_EXTERNAL_SERVER_CHANNEL_SECRET);

  let authTimeout: NodeJS.Timeout | null = setTimeout(() => {
    if (!authenticated && socket.connected) {
      socket.emit('authenticateError', { message: 'Authentication timed out' });
      socket.disconnect();
    }
  }, 30000);

  if (!tokenData) {
    socket.emit('authenticateError', { message: 'Invalid token' });
    socket.disconnect();
    return;
  }

  const id = tokenData.userId;
  const passwordVersion = tokenData.passwordVersion;

  const externalServerChannel = await getExternalServerChannel(id);

  if (!externalServerChannel) {
    socket.emit('authenticateError', { message: 'Invalid token' });
    socket.disconnect();
    return;
  }

  if (externalServerChannel.passwordVersion !== passwordVersion) {
    socket.emit('authenticateError', { message: 'Invalid token' });
    socket.disconnect();
    return;
  }

  // check if already connected
  const connectedSockets = await externalServerChannelIo.in(externalServerChannel.channelId).fetchSockets();
  if (connectedSockets.length > 0) {
    socket.emit('authenticateError', { message: 'Already connected' });
    socket.disconnect();
    return;
  }

  authenticated = true;
  clearTimeout(authTimeout);
  if (socket.connected) {
    authTimeout = null;
    socket.join(externalServerChannel.channelId);
    socket.emit('authenticated', { serverName: externalServerChannel.server.name, channelName: externalServerChannel.channel.name });
  }
}

export async function fetchFromExternalIo(channelId: string, payload: Payload): Promise<[any, null] | [null, string]> {
  return externalServerChannelIo
    .to(channelId)
    .timeout(10000)
    .emitWithAck('d', payload)
    .then((res) => (res.length ? res[0] : [null, 'Host is offline.']))
    .catch(() => [null, 'Host is offline.']);
}
