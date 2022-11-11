import { Socket } from 'socket.io';
import { AUTHENTICATE_ERROR } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';

interface ErrorOptions {
  message: string,
  data?: any,
  disconnect: boolean
}

export const emitError = (socket: Socket, opts: ErrorOptions) => {
  socket.emit(AUTHENTICATE_ERROR, {message: opts.message, data: opts.data});
  if (opts.disconnect) {
    socket.disconnect(true);
  }
};

interface EmitToOptions {
  to: string[];
  disconnect: boolean;
  message: string;
  data?: any;
}

export const emitErrorTo = (opts: EmitToOptions) => {
  const io = getIO();
  io.in(opts.to).emit(AUTHENTICATE_ERROR, {message: opts.message, data: opts.data});
  io.in(opts.to).disconnectSockets(true);
};