import { generateError } from '../common/errorHandler';
import { emitFriendRemoved, emitFriendRequestAccept, emitFriendRequestSent } from '../emits/Friend';
import { FriendModel, FriendStatus } from '../models/FriendModel';
import { User, UserModel } from '../models/UserModel';


export const getFriendIds = async (userId: string) => {
  const friends = await FriendModel.find({ user: userId, status: FriendStatus.FRIENDS });
  return friends.map(friend => friend.recipient.toString());
};

export const addFriend = async (userId: string, friendId: string) => {


  if (userId === friendId) {
    return [null, generateError('You cannot add yourself as a friend.')];
  }


  const alreadyFriends = await FriendModel.exists({user: userId, recipient: friendId});
  if (alreadyFriends) {
    return [null, generateError('Already in friends list.')];
  }


  
  
  const requesterObj = {
    user: userId,
    recipient: friendId,
    status: FriendStatus.SENT
  };
  const recipientObj = {
    user: friendId,
    recipient: userId,
    status: FriendStatus.PENDING
  };
  
  
  const docs = await FriendModel.insertMany([requesterObj, recipientObj]);
  
  const requester = await docs[0].populate<{recipient: User}>('recipient');
  const recipient = await docs[1].populate<{recipient: User}>('recipient');
  
  await UserModel.updateOne({_id: userId}, {$addToSet: {friends: requester.id}});
  await UserModel.updateOne({_id: friendId}, {$addToSet: {friends: recipient.id}});

  const recipientResponse = {...recipientObj, recipient: recipient.recipient};
  const requesterResponse = {...requesterObj, recipient: requester.recipient};


  emitFriendRequestSent(requesterResponse, recipientResponse);

  return [requesterResponse, null];
};


export const acceptFriend = async (userId: string, friendId: string) => {
  const friendRequest = await FriendModel.findOne({user: userId, recipient: friendId});

  if (!friendRequest) {
    return [null, generateError('Friend request does not exist.')];
  }

  if (friendRequest.status === FriendStatus.FRIENDS) {
    return [null, generateError('Friend request already accepted.')];
  }
  if (friendRequest.status === FriendStatus.SENT) {
    return [null, generateError('Cannot accept friend request because it is sent by you.')];
  }

  await FriendModel.updateOne({user: userId, recipient: friendId}, {$set: {status: FriendStatus.FRIENDS}});
  await FriendModel.updateOne({user: friendId, recipient: userId}, {$set: {status: FriendStatus.FRIENDS}});


  emitFriendRequestAccept(userId, friendId);
  return [{message: 'Accepted!'}, null];

};

export const removeFriend = async (userId: string, friendId: string) => {
  const friendRequest = await FriendModel.findOne({user: userId, recipient: friendId});
  
  if (!friendRequest) {
    return [null, generateError('Friend request does not exist.')];
  }
  


  await FriendModel.deleteOne({user: userId, recipient: friendId});
  await FriendModel.deleteOne({user: friendId, recipient: userId});


  await UserModel.updateOne({_id: userId}, {$pull: {friends: friendId}});
  await UserModel.updateOne({_id: friendId}, {$pull: {friends: userId}});

  emitFriendRemoved(userId, friendId);
  return [{message: 'Removed!'}, null];
};

