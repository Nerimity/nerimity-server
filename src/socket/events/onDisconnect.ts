import { Socket } from 'socket.io';
import { getAccountCacheBySocketId, socketDisconnect } from '../../cache/UserCache';
import { prisma } from '../../common/database';
import { emitUserPresenceUpdate } from '../../emits/User';
import { UserStatus } from '../../types/User';



export async function onDisconnect(socket: Socket) {
  const accountCache = await getAccountCacheBySocketId(socket.id);
  if (!accountCache) return;
  const userCache = accountCache.user;

  const isLastDisconnect = await socketDisconnect(socket.id, accountCache.user.id);

  const user = await prisma.user.findFirst({ where: {id: accountCache.user.id}, select: {status: true}});
  if (!user) return;


  if (isLastDisconnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(userCache.id, {status: UserStatus.OFFLINE, userId: userCache.id});
  }
  
  
}