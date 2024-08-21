import { Socket } from 'socket.io';
import { ActivityStatus, getUserIdBySocketId, updateCachePresence } from '../../cache/UserCache';
import { emitUserPresenceUpdate } from '../../emits/User';

interface Payload {
  name: string;
  action: string;
  startedAt?: number;
  endsAt?: number;
  link?: string;

  speed?: number;
  imgSrc?: string;
  title?: string;
  subtitle?: string;
}

export async function onChangeActivity(socket: Socket, payload: Payload | null) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;

  const activity = !payload
    ? null
    : ({
        socketId: socket.id,
        action: payload.action,
        name: payload.name,
        startedAt: payload.startedAt,
        endsAt: payload.endsAt,
        ...(payload?.speed && payload.speed > 1 ? { speed: payload.speed } : {}),
        link: payload.link,
        imgSrc: payload.imgSrc,
        title: payload.title,
        subtitle: payload.subtitle,
      } as Partial<ActivityStatus> | null);

  if (payload) {
    // check if startedAt is a number or undefined
    if (typeof payload.startedAt !== 'number' && payload.startedAt !== undefined) {
      return;
    }
    // check if endsAt is a number or undefined
    if (typeof payload.endsAt !== 'number' && payload.endsAt !== undefined) {
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
    // check if link is a string and is less than 200 characters
    if (payload.link && (typeof payload.link !== 'string' || payload.link.length > 200)) {
      return;
    }
    // check if imgSrc is a string and is less than 200 characters
    if (payload.imgSrc && (typeof payload.imgSrc !== 'string' || payload.imgSrc.length > 250)) {
      return;
    }
    // check if title is a string and is less than 100 characters
    if (payload.title && (typeof payload.title !== 'string' || payload.title.length > 30)) {
      return;
    }
    // check if subtitle is a string and is less than 100 characters
    if (payload.subtitle && (typeof payload.subtitle !== 'string' || payload.subtitle.length > 30)) {
      return;
    }
    // check if speed is a number or undefined and is less than 100
    if (payload.speed && (typeof payload.speed !== 'number' || payload.speed > 100)) {
      return;
    }
  }

  const shouldEmit = await updateCachePresence(userId, { activity: activity as ActivityStatus, userId });
  delete activity?.socketId;

  emitUserPresenceUpdate(userId, { activity: activity as ActivityStatus, userId }, !shouldEmit);
}
