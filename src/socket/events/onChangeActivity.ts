import { Socket } from 'socket.io';
import { ActivityStatus, getUserIdBySocketId, updateCachePresence } from '../../cache/UserCache';
import { emitSelfPresenceUpdate, emitUserPresenceUpdate } from '../../emits/User';

interface Payload {
  name: string;
  action: string;
  startedAt?: number;
}

export async function onChangeActivity(socket: Socket, payload: Payload | null) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;


  const activity = !payload ? null : {
    socketId: socket.id,
    action: payload.action,
    name: payload.name,
    startedAt: payload.startedAt,
  } as Partial<ActivityStatus> | null

  if (payload) {
    // check if startedAt is a number or undefined
    if (typeof payload.startedAt !== 'number' && payload.startedAt !== undefined) {
      return;
    }
    // check if action is a string and is less than 20 characters
    if (typeof payload.action !== 'string' || payload.action.length > 20) {
      return;
    }
    // check if name is a string and is less than 30 characters
    if (typeof payload.name !== 'string' || payload.name.length > 30) {
      return;
    }

  }

  const shouldEmit = await updateCachePresence(userId, { activity: activity as ActivityStatus, userId })
  delete activity?.socketId
  if (shouldEmit) emitUserPresenceUpdate(userId, { activity: activity as ActivityStatus, userId });
  emitSelfPresenceUpdate(userId, { activity: activity as ActivityStatus, userId });
}

