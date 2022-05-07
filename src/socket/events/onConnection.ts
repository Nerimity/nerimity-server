import { Socket } from 'socket.io';
import { AUTHENTICATE } from '../../common/ServerEventNames';
import { emitError } from '../../emits/Connection';
import { onAuthenticate } from './onAuthenticate';
import { onDisconnect } from './onDisconnect';

export function onConnection(socket: Socket) {
  let didEmitAuthenticate = false;
  
  socket.on(AUTHENTICATE, (data) => {
    didEmitAuthenticate = true;
    onAuthenticate(socket, data);
  });

  socket.on('disconnect', () => {
    onDisconnect(socket);
  });

  setTimeout(() => {
    if (!didEmitAuthenticate) {
      emitError(socket, {message: 'Authentication timed out', disconnect: true});
    }
  }, 30000);
}