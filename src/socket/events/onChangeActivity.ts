import { Socket } from 'socket.io';
import { ActivityStatus, getUserIdBySocketId, updateCachePresence } from '../../cache/UserCache';
import { emitUserPresenceUpdate } from '../../emits/User';
import { type } from 'arktype';

const Activity = type({
  name: 'string',
  action: 'string',

  'startedAt?': 'number',
  'endsAt?': 'number',
  'link?': 'string',
  'updatedAt?': 'number',
  'speed?': 'number',
  'imgSrc?': 'string',
  'title?': 'string',
  'subtitle?': 'string',
  'emoji?': 'string',
});
type Activity = typeof Activity.infer;

export async function onChangeActivity(socket: Socket, payload: Activity | null) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;

  if (!payload) {
    updateAndEmitActivity(userId, null);
    return;
  }

  const out = Activity(payload);

  if (out instanceof type.errors) {
    updateAndEmitActivity(userId, null);
    return;
  }

  if (out.action) {
    out.action = truncate(out.action, 20, false);
  }

  if (out.name) {
    out.name = truncate(out.name, 40);
  }

  if (out.link && out.link.length >= 200) {
    out.link = undefined;
  }

  if (out.imgSrc && out.imgSrc.length >= 200) {
    out.imgSrc = undefined;
  }

  if (out.title) {
    out.title = truncate(out.title, 50);
  }

  if (out.subtitle) {
    out.subtitle = truncate(out.subtitle, 50);
  }

  if (out.emoji && out.emoji.length >= 30) {
    out.emoji = undefined;
  }

  if (out.speed && out.speed < -100) {
    out.speed = undefined;
  }

  if (out.speed && out.speed > 100) {
    out.speed = undefined;
  }

  updateAndEmitActivity(userId, { ...out, socketId: socket.id });
}

async function updateAndEmitActivity(userId: string, activity: any) {
  const shouldEmit = await updateCachePresence(userId, { activity: activity as ActivityStatus, userId });
  delete activity?.socketId;

  emitUserPresenceUpdate(userId, { activity: activity as ActivityStatus, userId }, !shouldEmit);
}

function truncate(value: string, maxLength: number, ellipsis = true) {
  if (value.length <= maxLength) return value;

  return value.substring(0, maxLength) + (ellipsis ? '...' : '');
}
