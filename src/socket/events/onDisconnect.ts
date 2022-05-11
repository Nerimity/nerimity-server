import { Socket } from 'socket.io';
import { getAccountCacheBySocketId, socketDisconnect } from '../../cache/UserCache';
import { emitUserPresenceUpdate } from '../../emits/User';
import { UserModel, UserStatus } from '../../models/UserModel';



export async function onDisconnect(socket: Socket) {
  const accountCache = await getAccountCacheBySocketId(socket.id);
  if (!accountCache) return;
  const userCache = accountCache.user;

  const isLastDisconnect = await socketDisconnect(socket.id, accountCache.user._id.toString());

  const user = await UserModel.findOne({ _id: accountCache.user._id }).select('status');
  if (!user) return;


  if (isLastDisconnect && user.status !== UserStatus.OFFLINE) {
    emitUserPresenceUpdate(userCache._id, {status: UserStatus.OFFLINE, userId: userCache._id});
  }
  
  
}