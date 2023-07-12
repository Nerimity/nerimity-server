import { Friend, User } from '@prisma/client';
import { FRIEND_REQUEST_SENT, FRIEND_REQUEST_PENDING, FRIEND_REQUEST_ACCEPTED, FRIEND_REMOVED, USER_BLOCKED, USER_UNBLOCKED } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';



export const emitFriendRequestSent = (requester: Friend, recipient: Friend) => {
  const io = getIO();

  io.in(requester.userId).emit(FRIEND_REQUEST_SENT, requester);
  io.in(requester.recipientId).emit(FRIEND_REQUEST_PENDING, recipient);

};

export const emitFriendRequestAccept = (userId: string, friendId: string) => {
  const io = getIO();

  io.in(userId).emit(FRIEND_REQUEST_ACCEPTED, { friendId: friendId });
  io.in(friendId).emit(FRIEND_REQUEST_ACCEPTED, { friendId: userId });

};
export const emitFriendRemoved = (userId: string, friendId: string) => {
  const io = getIO();

  io.in(userId).emit(FRIEND_REMOVED, { friendId: friendId });
  io.in(friendId).emit(FRIEND_REMOVED, { friendId: userId });

};



export const emitUserBlocked = (userId: string, friend: User) => {
  const io = getIO();

  io.in(friend.id).emit(FRIEND_REMOVED, { friendId: userId });

  io.in(userId).emit(USER_BLOCKED, { user: friend });

};

export const emitUserUnblocked = (userId: string, friendId: string) => {
  const io = getIO();

  io.in(userId).emit(USER_UNBLOCKED, { userId: friendId });
};