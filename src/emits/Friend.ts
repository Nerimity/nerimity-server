import { FRIEND_REQUEST_SENT, FRIEND_REQUEST_PENDING, FRIEND_REQUEST_ACCEPTED, FRIEND_REMOVED } from '../common/ClientEventNames';
import { Friend, FriendStatus } from '../models/FriendModel';
import { User } from '../models/UserModel';
import { getIO } from '../socket/socket';


type FriendWithUser = Partial<Omit<Omit<Friend, 'recipient'>, 'user'>> & { recipient: User, user: string };

export const emitFriendRequestSent = (requester: FriendWithUser, recipient: FriendWithUser) => {
  const io = getIO();

  io.in(requester.user.toString()).emit(FRIEND_REQUEST_SENT, requester);
  io.in(requester.recipient._id.toString()).emit(FRIEND_REQUEST_PENDING, recipient);

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