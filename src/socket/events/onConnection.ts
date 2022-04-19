import { Socket } from 'socket.io';
import { AUTHENTICATE } from '../../common/ServerEventNames';
import { emitError } from '../../emits/Connection';
import { onAuthenticate } from './onAuthenticate';

export function onConnection(socket: Socket) {
  let didEmitAuthenticate = false;
  
  socket.on(AUTHENTICATE, (data) => {
    didEmitAuthenticate = true;
    onAuthenticate(socket, data);
  });

  setTimeout(() => {
    if (!didEmitAuthenticate) {
      emitError(socket, {message: 'Authentication timed out', disconnect: true});
    }
  }, 30000);
}