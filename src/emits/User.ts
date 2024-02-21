import { Inbox, UserNotificationSettings, User } from '@prisma/client';
import { Presence } from '../cache/UserCache';
import {
  INBOX_CLOSED,
  INBOX_OPENED,
  USER_CONNECTION_ADDED,
  USER_CONNECTION_REMOVED,
  USER_PRESENCE_UPDATE,
  USER_NOTIFICATION_SETTINGS_UPDATE,
  USER_UPDATED,
} from '../common/ClientEventNames';
import { NOTIFICATION_DISMISSED } from '../common/ClientEventNames';
import { emitToAll, getIO } from '../socket/socket';

export const emitUserPresenceUpdate = (
  userId: string,
  presence: Partial<Presence> & {
    userId: string;
  },
  selfOnly = false
) => {
  if (selfOnly) {
    getIO().to(userId).emit(USER_PRESENCE_UPDATE, presence);
    return;
  }
  emitToAll({
    event: USER_PRESENCE_UPDATE,
    userId,
    payload: presence,
  });
};

export const emitUserPresenceUpdateTo = (
  to: string | string[],
  presence: Presence
) => {
  getIO().to(to).emit(USER_PRESENCE_UPDATE, presence);
};

export const emitInboxOpened = (userId: string, inbox: Inbox) => {
  getIO().to(userId).emit(INBOX_OPENED, inbox);
};
export const emitInboxClosed = (userId: string, channelId: string) => {
  getIO().to(userId).emit(INBOX_CLOSED, { channelId });
};

export const emitNotificationDismissed = (
  userId: string,
  channelId: string
) => {
  getIO().to(userId).emit(NOTIFICATION_DISMISSED, { channelId });
};

export const emitUserUpdated = (
  userId: string,
  updated: { email?: string } & Partial<User>
) => {
  getIO().to(userId).emit(USER_UPDATED, updated);
};

export const emitUserNotificationSettingsUpdate = (
  userId: string,
  updated: Partial<UserNotificationSettings>,
  serverId?: string,
  channelId?: string
) => {
  getIO()
    .to(userId)
    .emit(USER_NOTIFICATION_SETTINGS_UPDATE, { serverId, channelId, updated });
};

export const emitUserConnectionRemoved = (
  userId: string,
  connectionId: string
) => {
  getIO().to(userId).emit(USER_CONNECTION_REMOVED, { connectionId });
};

export const emitUserConnectionAdded = (
  userId: string,
  connection: { provider: string; id: string; connectedAt: Date }
) => {
  getIO().to(userId).emit(USER_CONNECTION_ADDED, { connection });
};
