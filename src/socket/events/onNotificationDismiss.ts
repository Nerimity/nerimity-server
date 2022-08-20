import { Socket } from 'socket.io';
import { getAccountCacheBySocketId } from '../../cache/UserCache';
import { dismissChannelNotification } from '../../services/Channel';

interface Payload {
  channelId: string;
}

export async function onNotificationDismiss(socket: Socket, payload: Payload) {
  const accountCache = await getAccountCacheBySocketId(socket.id);
  if (!accountCache) return;
  const userCache = accountCache.user;

  dismissChannelNotification(userCache.id, payload.channelId);

}