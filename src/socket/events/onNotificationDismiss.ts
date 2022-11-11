import { Socket } from 'socket.io';
import { getUserIdBySocketId } from '../../cache/UserCache';
import { dismissChannelNotification } from '../../services/Channel';

interface Payload {
  channelId: string;
}

export async function onNotificationDismiss(socket: Socket, payload: Payload) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;

  dismissChannelNotification(userId, payload.channelId);

}