import { Socket } from 'socket.io';
import { AUTHENTICATE, NOTIFICATION_DISMISS, VOICE_SIGNAL_SEND } from '../../common/ServerEventNames';
import { emitError } from '../../emits/Connection';
import { onAuthenticate } from './onAuthenticate';
import { onDisconnect } from './onDisconnect';
import { onNotificationDismiss } from './onNotificationDismiss';
import { onVoiceSignal } from './onVoiceSignal';

export function onConnection(socket: Socket) {
  let didEmitAuthenticate = false;

  socket.on(AUTHENTICATE, (data) => {
    didEmitAuthenticate = true;
    onAuthenticate(socket, data);
  });

  socket.on(NOTIFICATION_DISMISS, (data) => onNotificationDismiss(socket, data));


  socket.on(VOICE_SIGNAL_SEND, (data) => onVoiceSignal(socket, data));


  socket.on('disconnect', () => onDisconnect(socket));

  setTimeout(() => {
    if (!didEmitAuthenticate) {
      emitError(socket, { message: 'Authentication timed out', disconnect: true });
    }
  }, 30000);
}