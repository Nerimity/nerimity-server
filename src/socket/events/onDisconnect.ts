import { Socket } from 'socket.io';
import { ActivityStatusWithoutSocketId, getUserIdBySocketId, getUserPresences, socketDisconnect, updateCachePresence } from '../../cache/UserCache';
import { dateToDateTime, prisma } from '../../common/database';
import { emitUserPresenceUpdate } from '../../emits/User';
import { UserStatus } from '../../types/User';
import { getVoiceUserByUserId } from '../../cache/VoiceCache';
import { leaveVoiceChannel } from '../../services/Voice';
import { LastOnlineStatus } from '../../services/User/User';
import { authQueue } from './onAuthenticate';

export async function onDisconnect(socket: Socket) {
  const ip = (socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address)?.toString();
  authQueue.add(
    async () => {
      await handleDisconnect(socket);
    },
    { groupName: ip },
  );
}

const handleDisconnect = async (socket: Socket) => {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;
  const presence = await getUserPresences({ userIds: [userId], includeSocketId: true });
  const isLastDisconnect = await socketDisconnect(socket.id, userId);

  const hasActivity = presence[0]?.activities?.find((a) => a.socketId === socket.id);

  if (!isLastDisconnect && hasActivity) {
    const { shouldEmit, presence } = await updateCachePresence({
      userId,
      socketId: socket.id,
      presence: {
        activities: null,
        userId,
      },
    });
    if (presence?.activities) {
      presence.activities = presence?.activities?.slice(0, 5);
    }

    emitUserPresenceUpdate(userId, { activities: presence?.activities, userId }, !shouldEmit);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { status: true, lastOnlineStatus: true },
  });
  if (!user) return;

  if (isLastDisconnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(userId, { status: UserStatus.OFFLINE, userId });

    if (user.lastOnlineStatus !== LastOnlineStatus.HIDDEN) {
      await prisma.user.update({
        where: { id: userId },
        data: { lastOnlineAt: dateToDateTime() },
      });
    }
  }

  const voice = await getVoiceUserByUserId(userId);
  if (voice?.socketId === socket.id) {
    leaveVoiceChannel(userId);
  }
};
