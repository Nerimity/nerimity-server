import { createAdapter, RedisAdapter } from '@socket.io/redis-adapter';
import socketIO from 'socket.io';
import http from 'http';
import { redisClient } from '../common/redis';
import { onConnection } from './events/onConnection';
import { getServerIds } from '../services/Server';

let io: socketIO.Server;

export async function createIO(server: http.Server) {
  io = new socketIO.Server(server, {
    transports: ['websocket']
  });

  const pub = redisClient;
  const sub = redisClient.duplicate();
  await sub.connect();

  io.adapter(createAdapter(pub, sub));
  io.on('connection', onConnection);

}

export function getIO() {
  return io as socketIO.Server;
}

export function getIOAdapter() {
  return io.of('/').adapter as RedisAdapter;
}

interface EmitToAllOptions {
  event: string;
  payload: any;
  userId: string;
  excludeSocketId?: string
}

export async function emitToAll(opts: EmitToAllOptions) {
  const { event, payload, userId, excludeSocketId } = opts;
  const serverIds = await getServerIds(userId);
  let broadcaster = getIO().to(serverIds);
  if (excludeSocketId) {
    broadcaster = broadcaster.except(excludeSocketId);
  }
  broadcaster.emit(event, payload);
}