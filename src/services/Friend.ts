import { generateError } from '../common/errorHandler';
import { emitFriendRequestSent } from '../emits/Friend';
import { FriendModel, FriendStatus } from '../models/FriendModel';
import { User, UserModel } from '../models/UserModel';

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