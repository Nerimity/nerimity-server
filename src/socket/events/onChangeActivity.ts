import { Socket } from 'socket.io';
import { ActivityStatus, ActivityStatusWithoutSocketId, getUserIdBySocketId, getUserPresences, updateCachePresence } from '../../cache/UserCache';
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

export async function onChangeActivity(socket: Socket, payload: Activity[] | null) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;

  if (!payload) {
    updateAndEmitActivity(userId, socket.id, null);
    return;
  }
  const activities: ActivityStatus[] = [];

  payload.forEach((act) => {
    const out = Activity(act);
    if (out instanceof type.errors) {
      return;
    }

    if (out.action) {
      out.action = truncate(out.action, 30, false);
    }

    if (out.name) {
      out.name = truncate(out.name, 80);
    }

    if (out.link && out.link.length >= 300) {
      out.link = undefined;
    }

    if (out.imgSrc && out.imgSrc.length >= 300) {
      out.imgSrc = undefined;
    }

    if (out.title) {
      out.title = truncate(out.title, 80);
    }

    if (out.subtitle) {
      out.subtitle = truncate(out.subtitle, 80);
    }

    if (out.emoji && out.emoji.length >= 50) {
      out.emoji = undefined;
    }

    if (out.speed && out.speed < -100) {
      out.speed = undefined;
    }

    if (out.speed && out.speed > 100) {
      out.speed = undefined;
    }

    activities.push({ ...out, socketId: socket.id });
  });

  updateAndEmitActivity(userId, socket.id, activities);
}

async function updateAndEmitActivity(userId: string, socketId: string, activities: ActivityStatus[] | null) {
  const { shouldEmit } = await updateCachePresence({ socketId, presence: { userId, activities }, userId });

  const presences = await getUserPresences({ userIds: [userId], includeSocketId: false, limitActivities: false });
  const allActivities = presences[0]?.activities;

  emitUserPresenceUpdate(userId, { activities: allActivities, userId }, !shouldEmit);
}

function truncate(value: string, maxLength: number, ellipsis = true) {
  if (value.length <= maxLength) return value;

  return value.substring(0, maxLength) + (ellipsis ? '...' : '');
}
