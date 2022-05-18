import { generateError } from '../common/errorHandler';
import { emitFriendRequestSent } from '../emits/Friend';
import { FriendModel, FriendStatus } from '../models/FriendModel';
import { User, UserModel } from '../models/UserModel';

export const addFriend = async (userId: string, friendId: string) => {
  
  // todo: check if "already friends" works.
  const alreadyFriends = await UserModel.exists({_id: userId, friends: friendId});
  if (alreadyFriends) {
    return [null, generateError('Already in friends list.')];
  }


  await UserModel.updateOne({_id: userId}, {$addToSet: {friends: friendId}});

  await UserModel.updateOne({_id: friendId}, {$addToSet: {friends: userId}});


  const requesterObj = {
    user: userId,
    friend: friendId,
    status: FriendStatus.SENT
  };
  const recipientObj = {
    user: friendId,
    friend: userId,
    status: FriendStatus.PENDING
  };


  const docs = await FriendModel.insertMany([requesterObj, recipientObj]);

  const requester = await docs[0].populate<{friend: User}>('friend', 'username tag avatar hexColor');
  const recipient = await docs[1].populate<{friend: User}>('friend', 'username tag avatar hexColor');


  emitFriendRequestSent(requester.toObject({versionKey: false}), recipient.toObject({versionKey: false}));

  return [requester, null];
};