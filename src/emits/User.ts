import { Inbox, UserNotificationSettings, User, Prisma } from '@prisma/client';
import { Presence } from '../cache/UserCache';
import { INBOX_CLOSED, INBOX_OPENED, USER_CONNECTION_ADDED, USER_CONNECTION_REMOVED, USER_PRESENCE_UPDATE, USER_NOTIFICATION_SETTINGS_UPDATE, USER_UPDATED, USER_NOTICE_CREATED, USER_UPDATED_SELF } from '../common/ClientEventNames';
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

export const emitUserPresenceUpdateTo = (to: string | string[], presence: Presence) => {
  getIO().to(to).emit(USER_PRESENCE_UPDATE, presence);
};

export const emitInboxOpened = (userId: string, inbox: Inbox) => {
  getIO().to(userId).emit(INBOX_OPENED, inbox);
};
export const emitInboxClosed = (userId: string, channelId: string) => {
  getIO().to(userId).emit(INBOX_CLOSED, { channelId });
};

export const emitNotificationDismissed = (userId: string, channelId: string) => {
  getIO().to(userId).emit(NOTIFICATION_DISMISSED, { channelId });
};

export const emitUserUpdatedSelf = (userId: string, updated: { email?: string } & Partial<User>) => {
  getIO().to(userId).emit(USER_UPDATED_SELF, updated);
};

export const emitUserUpdated = (userId: string, updated: Partial<User>) => {
  if (Object.keys(updated).length === 0) return;

  emitToAll({
    excludeSelf: true,
    event: USER_UPDATED,
    payload: { userId, updated },
    userId,
  });
};

export const emitUserNotificationSettingsUpdate = (userId: string, updated: Partial<UserNotificationSettings>, serverId?: string, channelId?: string) => {
  getIO().to(userId).emit(USER_NOTIFICATION_SETTINGS_UPDATE, { serverId, channelId, updated });
};

export const emitUserConnectionRemoved = (userId: string, connectionId: string) => {
  getIO().to(userId).emit(USER_CONNECTION_REMOVED, { connectionId });
};

export const emitUserConnectionAdded = (userId: string, connection: { provider: string; id: string; connectedAt: Date }) => {
  getIO().to(userId).emit(USER_CONNECTION_ADDED, { connection });
};

const UserNotice = {
  select: { userId: true, id: true, type: true, title: true, content: true, createdAt: true, createdBy: { select: { username: true } } },
} satisfies { select: Prisma.UserNoticeSelect };

type UserNotice = Prisma.UserNoticeGetPayload<typeof UserNotice>;

export const emitUserNoticeCreates = (notices: UserNotice[]) => {
  for (let i = 0; i < notices.length; i++) {
    const notice = notices[i]!;
    getIO()
      .to(notice.userId)
      .emit(USER_NOTICE_CREATED, { ...notice, userId: undefined });
  }
};
