import { Presence } from '../cache/UserCache';
import { INBOX_OPENED, USER_PRESENCE_UPDATE } from '../common/ClientEventNames';
import { Inbox } from '../models/InboxModel';
import { emitToAll, getIO } from '../socket/socket';

export const emitUserPresenceUpdate = (userId: string, presence: Presence, socketId?: string) => {
  emitToAll({
    event: USER_PRESENCE_UPDATE,
    userId,
    payload: presence,
    excludeSocketId: socketId
  });

};


export const emitInboxOpened = (userId: string, inbox: Inbox) => {
  getIO().to(userId).emit(INBOX_OPENED, inbox);
};