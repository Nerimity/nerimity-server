import { FRIEND_REQUEST_SENT, FRIEND_REQUEST_PENDING } from '../common/ClientEventNames';
import { Friend } from '../models/FriendModel';
import { User } from '../models/UserModel';
import { emitToAll, getIO } from '../socket/socket';


type FriendWithUser = Friend & { friend: User };

export const emitFriendRequestSent = (requester: FriendWithUser, recipient: FriendWithUser) => {
  const io = getIO();

  io.in(requester.user.toString()).emit(FRIEND_REQUEST_SENT, recipient);
  io.in(requester.friend._id.toString()).emit(FRIEND_REQUEST_PENDING, requester);


};