import { Socket } from 'socket.io';
import { getUserIdBySocketId, socketDisconnect } from '../../cache/UserCache';
import { prisma } from '../../common/database';
import { emitUserPresenceUpdate } from '../../emits/User';
import { UserStatus } from '../../types/User';



export async function onDisconnect(socket: Socket) {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;
  const isLastDisconnect = await socketDisconnect(socket.id, userId);

  const user = await prisma.user.findFirst({ where: {id: userId}, select: {status: true}});
  if (!user) return;

  if (isLastDisconnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(userId, {status: UserStatus.OFFLINE, userId});
  }
}