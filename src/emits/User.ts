import { Presence } from '../cache/UserCache';
import { USER_PRESENCE_UPDATE } from '../common/ClientEventNames';
import { emitToAll } from '../socket/socket';

export const emitUserPresenceUpdate = (userId: string, presence: Presence, socketId?: string) => {
  emitToAll({
    event: USER_PRESENCE_UPDATE,
    userId,
    payload: presence,
    excludeSocketId: socketId
  });

};