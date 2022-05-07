import { Socket } from 'socket.io';
import { getAccountCacheBySocketId, socketDisconnect } from '../../cache/UserCache';



export async function onDisconnect(socket: Socket) {
  const accountCache = await getAccountCacheBySocketId(socket.id);
  if (!accountCache) return;

  const isLastDisconnect = await socketDisconnect(socket.id, accountCache.user._id.toString());

  console.log('isLastDisconnect', isLastDisconnect);
  
}