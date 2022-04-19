import { Socket } from 'socket.io';
import { AUTHENTICATE_ERROR } from '../common/ClientEventNames';

interface ErrorOptions {
  message: string,
  disconnect: boolean
}

export const emitError = (socket: Socket, opts: ErrorOptions) => {
  socket.emit(AUTHENTICATE_ERROR, opts.message);
  if (opts.disconnect) {
    socket.disconnect(true);
  }
};