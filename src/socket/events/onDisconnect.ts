import { Socket } from 'socket.io';
import { getUserIdBySocketId, getUserPresences, socketDisconnect, updateCachePresence } from '../../cache/UserCache';
import { dateToDateTime, prisma } from '../../common/database';
import { emitUserPresenceUpdate } from '../../emits/User';
import { UserStatus } from '../../types/User';
import { getVoiceUserByUserId } from '../../cache/VoiceCache';
import { leaveVoiceChannel } from '../../services/Voice';
import { LastOnlineStatus } from '../../services/User/User';
import { authQueue } from './onAuthenticate';

export async function onDisconnect(socket: Socket) {
  const ip = (socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address)?.toString();
  const finish = await authQueue.start({ groupName: ip });
  await handleDisconnect(socket).finally(() => finish());
}

const handleDisconnect = async (socket: Socket) => {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;
  const presence = await getUserPresences([userId], true);
  const isLastDisconnect = await socketDisconnect(socket.id, userId);

  if (!isLastDisconnect && presence[0]?.activity?.socketId === socket.id) {
    const shouldEmit = await updateCachePresence(userId, { activity: null, userId });
    emitUserPresenceUpdate(userId, { activity: null, userId }, !shouldEmit);
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
