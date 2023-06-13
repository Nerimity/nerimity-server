import { getUserPresences } from '../cache/UserCache';
import { exists, prisma } from '../common/database';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import {
  emitFriendRemoved,
  emitFriendRequestAccept,
  emitFriendRequestSent,
} from '../emits/Friend';
import { emitUserPresenceUpdateTo } from '../emits/User';
import { FriendStatus } from '../types/Friend';

export const getFriendIds = async (userId: string) => {
  const friends = await prisma.friend.findMany({
    where: { userId: userId, status: FriendStatus.FRIENDS },
  });
  return friends.map((friend) => friend.recipientId);
};

export const addFriend = async (userId: string, friendId: string) => {
  if (userId === friendId) {
    return [null, generateError('You cannot add yourself as a friend.')];
  }

  const alreadyFriends = await exists(prisma.friend, {
    where: { userId: userId, recipientId: friendId },
  });
  if (alreadyFriends) {
    return [null, generateError('Already in friends list.')];
  }

  const requesterObj = {
    id: generateId(),
    userId: userId,
    recipientId: friendId,
    status: FriendStatus.SENT,
  };
  const recipientObj = {
    id: generateId(),
    userId: friendId,
    recipientId: userId,
    status: FriendStatus.PENDING,
  };

  const docs = await prisma.$transaction([
    prisma.friend.create({ data: requesterObj, include: { recipient: true } }),
    prisma.friend.create({ data: recipientObj, include: { recipient: true } }),
  ]);

  const requester = docs[0];
  const recipient = docs[1];

  const requesterResponse = { ...requester, recipient: requester.recipient };
  const recipientResponse = { ...recipient, recipient: recipient.recipient };

  emitFriendRequestSent(requesterResponse, recipientResponse);

  return [requesterResponse, null];
};

export const acceptFriend = async (userId: string, friendId: string) => {
  const friendRequest = await prisma.friend.findFirst({
    where: { userId: userId, recipientId: friendId },
  });

  if (!friendRequest) {
    return [null, generateError('Friend request does not exist.')];
  }

  if (friendRequest.status === FriendStatus.FRIENDS) {
    return [null, generateError('Friend request already accepted.')];
  }
  if (friendRequest.status === FriendStatus.SENT) {
    return [
      null,
      generateError('Cannot accept friend request because it is sent by you.'),
    ];
  }

  await prisma.$transaction([
    prisma.friend.update({
      where: { userId_recipientId: { userId: userId, recipientId: friendId } },
      data: { status: FriendStatus.FRIENDS },
    }),
    prisma.friend.update({
      where: { userId_recipientId: { userId: friendId, recipientId: userId } },
      data: { status: FriendStatus.FRIENDS },
    }),
  ]);

  emitFriendRequestAccept(userId, friendId);

  const [userPresence, friendPresence] = await getUserPresences([
    userId,
    friendId,
  ]);
  userPresence && emitUserPresenceUpdateTo(userId, friendPresence);
  friendPresence && emitUserPresenceUpdateTo(friendId, userPresence);

  return [{ message: 'Accepted!' }, null];
};

export const removeFriend = async (userId: string, friendId: string) => {
  const friendRequest = await prisma.friend.findFirst({
    where: { userId: userId, recipientId: friendId },
  });

  if (!friendRequest) {
    return [null, generateError('Friend request does not exist.')];
  }

  await prisma.$transaction([
    prisma.friend.deleteMany({
      where: { userId: userId, recipientId: friendId },
    }),
    prisma.friend.deleteMany({
      where: { userId: friendId, recipientId: userId },
    }),
  ]);

  emitFriendRemoved(userId, friendId);
  return [{ message: 'Removed!' }, null];
};
