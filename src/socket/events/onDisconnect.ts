import { Socket } from 'socket.io';
import { getUserIdBySocketId, getUserPresences, socketDisconnect, updateCachePresence } from '../../cache/UserCache';
import { prisma } from '../../common/database';
import { emitSelfPresenceUpdate, emitUserPresenceUpdate } from '../../emits/User';
import { UserStatus } from '../../types/User';
import {
  getVoiceUserByUserId,
} from '../../cache/VoiceCache';
import { leaveVoiceChannel } from '../../services/Voice';


export async function onDisconnect(socket: Socket) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;
  const presence = await getUserPresences([userId], true);
  const isLastDisconnect = await socketDisconnect(socket.id, userId);

  if (!isLastDisconnect && presence[0]?.activity?.socketId === socket.id) {
    const shouldEmit = await updateCachePresence(userId, { activity: null, userId })
    if (shouldEmit) emitUserPresenceUpdate(userId, { activity: null, userId });
    emitSelfPresenceUpdate(userId, { activity: null, userId });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { status: true },
  });
  if (!user) return;

  if (isLastDisconnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(userId, { status: UserStatus.OFFLINE, userId });
  }

  const voice = await getVoiceUserByUserId(userId);
  if (voice?.socketId === socket.id) {
    leaveVoiceChannel(userId);
  }
}
