import { Friend } from '@prisma/client';
import { FRIEND_REQUEST_SENT, FRIEND_REQUEST_PENDING, FRIEND_REQUEST_ACCEPTED, FRIEND_REMOVED } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';



export const emitFriendRequestSent = (requester: Friend, recipient: Friend) => {
  const io = getIO();

  io.in(requester.userId).emit(FRIEND_REQUEST_SENT, requester);
  io.in(requester.recipientId).emit(FRIEND_REQUEST_PENDING, recipient);

};

export const emitFriendRequestAccept = (userId: string, friendId: string) => {
  const io = getIO();

  io.in(userId).emit(FRIEND_REQUEST_ACCEPTED, {friendId: friendId});
  io.in(friendId).emit(FRIEND_REQUEST_ACCEPTED, {friendId: userId});

};
export const emitFriendRemoved = (userId: string, friendId: string) => {
  const io = getIO();

  io.in(userId).emit(FRIEND_REMOVED, {friendId: friendId});
  io.in(friendId).emit(FRIEND_REMOVED, {friendId: userId});

};