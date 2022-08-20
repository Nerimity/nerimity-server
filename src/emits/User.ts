import { Inbox } from '@prisma/client';
import { Presence } from '../cache/UserCache';
import { INBOX_OPENED, USER_PRESENCE_UPDATE } from '../common/ClientEventNames';
import { NOTIFICATION_DISMISSED } from '../common/ClientEventNames';
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
export const emitNotificationDismissed = (userId: string, channelId: string) => {
  getIO().to(userId).emit(NOTIFICATION_DISMISSED, {channelId});
};