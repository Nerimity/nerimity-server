import { Friend } from '@src/generated/prisma/client';
import { deleteAllInboxCache } from '../cache/ChannelCache';
import { getUserPresences } from '../cache/UserCache';
import { exists, prisma, publicUserExcludeFields } from '../common/database';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { emitFriendRemoved, emitFriendRequestAccept, emitFriendRequestSent, emitUserBlocked, emitUserUnblocked } from '../emits/Friend';
import { emitUserPresenceUpdateTo } from '../emits/User';
import { FriendStatus } from '../types/Friend';
import { FriendRequestStatus } from './User/User';

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

  const friendAccount = await prisma.account.findUnique({
    where: {
      userId: friendId,
    },
    select: {
      friendRequestStatus: true,
    },
  });

  if (!friendAccount) {
    return [null, generateError('This user does not exist.')];
  }

  const friendRequestStatus = friendAccount?.friendRequestStatus || FriendRequestStatus.OPEN;

  if (friendRequestStatus === FriendRequestStatus.CLOSED) {
    return [null, generateError('This user has disabled friend requests.')];
  }

  if (friendRequestStatus === FriendRequestStatus.SERVERS) {
    const doesShareServers = await prisma.server.findFirst({
      where: {
        AND: [{ serverMembers: { some: { userId: friendId } } }, { serverMembers: { some: { userId } } }],
      },
    });
    if (!doesShareServers) {
      return [null, generateError('This user has disabled friend requests.')];
    }
  }

  // check if blocked

  const blocked = await prisma.friend.findFirst({
    where: {
      status: FriendStatus.BLOCKED,
      OR: [
        { recipientId: userId, userId: friendId },
        { recipientId: friendId, userId: userId },
      ],
    },
  });

  if (blocked) {
    return [null, generateError('This user is blocked.')];
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

  const docs = await prisma
    .$transaction([
      prisma.friend.create({
        data: requesterObj,
        include: { recipient: { select: publicUserExcludeFields } },
      }),
      prisma.friend.create({
        data: recipientObj,
        include: { recipient: { select: publicUserExcludeFields } },
      }),
    ])
    .catch(() => null);
  if (!docs) {
    return [null, generateError('Failed to add friend.')];
  }

  const requester = docs[0];
  const recipient = docs[1];

  const requesterResponse = { ...requester, recipient: requester.recipient };
  const recipientResponse = { ...recipient, recipient: recipient.recipient };

  emitFriendRequestSent(requesterResponse, recipientResponse);

  return [requesterResponse, null];
};

export const acceptFriend = async (userId: string, friendId: string) => {
  const isBlocked = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: userId, recipientId: friendId },
        { userId: friendId, recipientId: userId },
      ],
      status: FriendStatus.BLOCKED,
    },
  });

  if (isBlocked) {
    return [null, generateError('This friend is blocked.')];
  }

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
    return [null, generateError('Cannot accept friend request because it is sent by you.')];
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

  deleteAllInboxCache(userId);
  emitFriendRequestAccept(userId, friendId);

  const [userPresence, friendPresence] = await getUserPresences([userId, friendId]);
  userPresence && emitUserPresenceUpdateTo(userId, friendPresence);
  friendPresence && emitUserPresenceUpdateTo(friendId, userPresence);

  return [{ message: 'Accepted!' }, null];
};

export const removeFriend = async (userId: string, friendId: string) => {
  const isBlocked = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: userId, recipientId: friendId },
        { userId: friendId, recipientId: userId },
      ],
      status: FriendStatus.BLOCKED,
    },
  });

  if (isBlocked) {
    return [null, generateError('This friend is already removed.')];
  }

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

  deleteAllInboxCache(userId);
  emitFriendRemoved(userId, friendId);
  return [{ message: 'Removed!' }, null];
};

export async function blockUser(requesterId: string, userToBlockId: string) {
  const userToBlock = await prisma.user.findFirst({
    where: { id: userToBlockId },
    select: publicUserExcludeFields,
  });
  if (!userToBlock) {
    return [null, generateError('User does not exist.')] as const;
  }

  const friend = await prisma.friend.findFirst({
    where: { userId: requesterId, recipientId: userToBlockId },
  });
  const recipientFriend = await prisma.friend.findFirst({
    where: { userId: userToBlockId, recipientId: requesterId },
  });
  if (friend?.status === FriendStatus.BLOCKED) {
    return [null, generateError('This user is already blocked.')] as const;
  }
  await prisma.$transaction([
    prisma.friend.deleteMany({
      where: {
        OR: [
          {
            userId: requesterId,
            recipientId: userToBlockId,
            status: { not: { equals: FriendStatus.BLOCKED } },
          },
          {
            userId: userToBlockId,
            recipientId: requesterId,
            status: { not: { equals: FriendStatus.BLOCKED } },
          },
        ],
      },
    }),
    prisma.friend.create({
      data: {
        id: generateId(),
        userId: requesterId,
        recipientId: userToBlockId,
        status: FriendStatus.BLOCKED,
      },
    }),
    prisma.follower.deleteMany({
      where: {
        OR: [
          { followedById: userToBlockId, followedToId: requesterId },
          { followedById: requesterId, followedToId: userToBlockId },
        ],
      },
    }),
  ]);
  await deleteAllInboxCache(requesterId);
  // emit friend blocked
  emitUserBlocked(requesterId, userToBlock, recipientFriend && recipientFriend.status !== FriendStatus.BLOCKED);
  return [true, null] as const;
}

export async function unblockUser(requesterId: string, userToUnBlockId: string) {
  const friend = await prisma.friend.findFirst({
    where: { userId: requesterId, recipientId: userToUnBlockId },
  });

  if (friend?.status !== FriendStatus.BLOCKED) {
    return [null, generateError('This user is not blocked.')] as const;
  }

  await prisma.friend.delete({
    where: {
      id: friend.id,
    },
  });
  await deleteAllInboxCache(requesterId);

  // emit friend unblocked
  emitUserUnblocked(requesterId, userToUnBlockId);
  return [true, null] as const;
}
