import { CustomError, generateError } from '../../common/errorHandler';
import { CustomResult } from '../../common/CustomResult';
import {
  emitInboxClosed,
  emitInboxOpened,
  emitUserPresenceUpdate,
  emitUserNotificationSettingsUpdate,
} from '../../emits/User';
import { ChannelType } from '../../types/Channel';
import { Presence, updateCachePresence } from '../../cache/UserCache';
import { FriendStatus } from '../../types/Friend';
import {
  excludeFields,
  prisma,
  publicUserExcludeFields,
} from '../../common/database';
import { generateId } from '../../common/flakeId';

import {
  createPostNotification,
  fetchLatestPost,
  PostNotificationType,
} from '../Post';

import { leaveVoiceChannel } from '../Voice';
import { MessageInclude } from '../Message';
import { removeDuplicates } from '../../common/utils';
import { isUserAdmin } from '../../common/Bitwise';
import { Prisma } from '@prisma/client';

export const getBlockedUserIds = async (
  userIds: string[],
  blockedUserId: string
) => {
  const blockedUsers = await prisma.friend.findMany({
    where: {
      status: FriendStatus.BLOCKED,
      recipientId: blockedUserId,
      userId: { in: removeDuplicates(userIds).filter((id) => id) },
    },
    select: { userId: true },
  });
  return blockedUsers.map((b) => b.userId);
};

export const isUserBlocked = async (userId: string, blockedById: string) => {
  const blockedUser = await prisma.friend.findFirst({
    where: {
      status: FriendStatus.BLOCKED,
      recipientId: userId,
      userId: blockedById,
    },
  });
  return !!blockedUser;
};

export const isExpired = (expireDate: Date) => {
  const now = new Date();
  return now > expireDate;
};

export const isIpBanned = async (ipAddress: string) => {
  const ban = await prisma.bannedIp.findFirst({ where: { ipAddress } });
  if (!ban) return false;
  if (!ban.expireAt) return ban;

  if (!isExpired(ban.expireAt)) {
    return ban;
  }
  await prisma.bannedIp.delete({ where: { ipAddress } });
  return false;
};

export const getSuspensionDetails = async (userId: string) => {
  const suspend = await prisma.suspension.findFirst({ where: { userId }, include: {suspendBy: {select: {username: true,}}} });
  if (!suspend) return false;
  if (!suspend.expireAt) return suspend;

  if (!isExpired(suspend.expireAt)) {
    return suspend;
  }

  await prisma.suspension.delete({ where: { userId } });
  return false;
};

export const getAccountByUserId = (userId: string) => {
  return prisma.account.findFirst({
    where: { userId },
    select: { ...excludeFields('Account', ['password']), user: true },
  });
};

export const getUserWithAccount = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      account: {
        select: excludeFields('Account', ['password']),
      },
      application: {
        select: { id: true, botTokenVersion: true },
      },
    },
  });
};

export const closeDMChannel = async (userId: string, channelId: string) => {
  const inbox = await prisma.inbox.findFirst({
    where: {
      channelId,
      createdById: userId,
    },
  });
  if (!inbox) return [null, generateError('Channel does not exist.')] as const;

  if (inbox.closed)
    return [null, generateError('This channel is already closed.')] as const;

  await leaveVoiceChannel(userId, channelId);

  await prisma.inbox.update({
    where: { id: inbox.id },
    data: { closed: true },
  });

  emitInboxClosed(userId, channelId);
  return [true, null] as const;
};

// this function is used to open a channel and inbox.
// if the recipient has not opened the channel, it will be created.
// if the recipient has opened the channel, we will create a new inbox with the existing channel id.
export const openDMChannel = async (userId: string, friendId: string) => {
  const inbox = await prisma.inbox.findFirst({
    where: {
      OR: [
        {
          createdById: userId,
          recipientId: friendId,
        },
        {
          createdById: friendId,
          recipientId: userId,
        },
      ],
    },
  });

  if (inbox?.channelId) {
    const myInbox = await prisma.inbox.findFirst({
      where: { channelId: inbox.channelId, createdById: userId },
      include: {
        channel: true,
        recipient: { select: publicUserExcludeFields },
      },
    });
    if (myInbox) {
      if (myInbox.closed) {
        myInbox.closed = false;
        await prisma.inbox.update({
          where: { id: myInbox.id },
          data: { closed: false },
        });
        emitInboxOpened(userId, myInbox);
      }

      return [myInbox, null] as const;
    }
  }

  const newChannel = inbox
    ? { id: inbox?.channelId }
    : await prisma.channel.create({
        data: {
          id: generateId(),
          type: ChannelType.DM_TEXT,
          createdById: userId,
        },
      });

  const newInbox = await prisma.inbox
    .create({
      data: {
        id: generateId(),
        channelId: newChannel.id,
        createdById: userId,
        recipientId: friendId,
        closed: false,
      },
      include: {
        channel: { include: { _count: { select: { attachments: true } } } },
        recipient: { select: publicUserExcludeFields },
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .catch(() => {});

  if (!newInbox) {
    return [null, generateError('Something went wrong.')] as const;
  }

  const recipientInbox = await prisma.inbox.findFirst({
    where: {
      createdById: friendId,
      recipientId: userId,
    },
  });
  if (!recipientInbox) {
    // also create a closed inbox for recipient
    await prisma.inbox.create({
      data: {
        id: generateId(),
        channelId: newChannel.id,
        createdById: friendId,
        recipientId: userId,
        closed: true,
      },
    });
  }

  emitInboxOpened(userId, newInbox);

  return [newInbox, null] as const;
};

type PresencePayload = Partial<Omit<Omit<Presence, 'custom'>, 'userId'>> & {
  custom?: null | string;
};

export const updateUserPresence = async (
  userId: string,
  presence: PresencePayload
) => {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) {
    return [null, generateError('User not found.', 'user')];
  }

  const newUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status: presence.status,
      customStatus: presence.custom,
    },
    select: { customStatus: true, status: true },
  });

  const shouldEmit = await updateCachePresence(userId, {
    ...presence,
    userId,
  });

  let emitPayload: (PresencePayload & { userId: string }) | undefined;

  if (!user.status && presence.status) {
    // emit everything when going from offline to online
    emitPayload = {
      custom: newUser.customStatus || undefined,
      status: newUser.status,
      userId: user.id,
    };
  } else {
    emitPayload = { ...presence, userId: user.id };
  }

  emitUserPresenceUpdate(userId, emitPayload, !shouldEmit);

  return ['Presence updated.', null];
};

export const getUserDetails = async (
  requesterId: string,
  recipientId: string
) => {
  const user = await prisma.user.findFirst({
    where: { id: recipientId },
    select: {
      ...publicUserExcludeFields,
      followers: {
        where: { followedById: requesterId },
        select: { followedToId: true },
      },
      following: {
        where: { followedById: requesterId },
        select: { followedToId: true },
      },
      profile: { select: { bio: true, bgColorOne: true, bgColorTwo: true, primaryColor: true } },
      _count: {
        select: {
          followers: true,
          following: true,
          likedPosts: true,
          posts: { where: { deleted: null } },
        },
      },
    },
  });

  if (!user) {
    return [null, generateError('User not found.', 'user')];
  }

  // get mutual Friends
  const recipientFriends = await prisma.friend.findMany({
    where: { userId: recipientId, status: FriendStatus.FRIENDS },
  });
  const recipientFriendsIds = recipientFriends.map(
    (friend) => friend.recipientId
  );

  const mutualFriends = await prisma.friend.findMany({
    where: {
      status: FriendStatus.FRIENDS,
      userId: requesterId,
      recipientId: { in: recipientFriendsIds },
    },
  });
  const mutualFriendIds = mutualFriends.map((friend) => friend.recipientId);

  // Get mutual servers
  const recipient = await prisma.user.findFirst({
    where: { id: recipientId },
    select: { servers: { select: { id: true } } },
  });
  const recipientServerIds = recipient?.servers.map((server) => server.id);

  const members = await prisma.serverMember.findMany({
    where: { userId: requesterId, serverId: { in: recipientServerIds } },
  });
  const mutualServerIds = members.map((member) => member.serverId);

  const isAdmin = isUserAdmin(user.badges);

  // get latest post
  const latestPost = await fetchLatestPost({
    userId: recipientId,
    requesterUserId: requesterId,
    bypassBlocked: isAdmin,
  });

  const isBlocked = await isUserBlocked(requesterId, recipientId);

  return [
    {
      block: isBlocked,
      user: { ...user, profile: undefined },
      mutualFriendIds,
      mutualServerIds,
      latestPost,
      profile: user.profile,
    },
    null,
  ];
};

export enum DmStatus {
  OPEN = 0,
  FRIENDS_AND_SERVERS = 1,
  FRIENDS = 2,
}
export enum FriendRequestStatus {
  OPEN = 0,
  SERVERS = 1,
  CLOSED = 2,
}

export async function followUser(
  requesterId: string,
  followToId: string
): Promise<CustomResult<boolean, CustomError>> {
  // check if already following
  const existingFollow = await prisma.follower.findFirst({
    where: { followedById: requesterId, followedToId: followToId },
  });
  if (existingFollow)
    return [null, generateError('You are already following this user.')];

  if (requesterId === followToId) {
    return [null, generateError('You cannot follow yourself.')];
  }

  // check if blocked
  const blocked = await prisma.friend.findFirst({
    where: {
      status: FriendStatus.BLOCKED,
      OR: [
        { recipientId: requesterId, userId: followToId },
        { recipientId: followToId, userId: requesterId },
      ],
    },
  });

  if (blocked) {
    return [null, generateError('This user is blocked.')];
  }

  await prisma.follower.create({
    data: {
      id: generateId(),
      followedById: requesterId,
      followedToId: followToId,
    },
  });
  createPostNotification({
    type: PostNotificationType.FOLLOWED,
    byId: requesterId,
    toId: followToId,
  });
  return [true, null];
}

export async function unfollowUser(
  requesterId: string,
  unfollowId: string
): Promise<CustomResult<boolean, CustomError>> {
  // check if already following
  const existingFollow = await prisma.follower.findFirst({
    where: { followedById: requesterId, followedToId: unfollowId },
  });
  if (!existingFollow)
    return [null, generateError('You are already not following this user.')];

  await prisma.follower.delete({ where: { id: existingFollow.id } });
  return [true, null];
}

export async function followingUsers(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      following: {
        select: { followedTo: { select: publicUserExcludeFields } },
      },
    },
  });
  if (!user) return [null, generateError('invalid User')];
  return [user?.following.map((follower) => follower.followedTo), null];
}

export async function followerUsers(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      followers: {
        select: { followedBy: { select: publicUserExcludeFields } },
      },
    },
  });
  if (!user) return [null, generateError('invalid User')];
  return [user?.followers.map((follower) => follower.followedBy), null];
}

export const NotificationSoundMode = {
  INITIAL: null,
  ALL: 0,
  MENTIONS_ONLY: 1,
  MUTE: 2,
} as const;
export const NotificationPingMode = {
  INITIAL: null,
  ALL: 0,
  MENTIONS_ONLY: 1,
  MUTE: 2,
} as const;

type NonNullable<T> = Exclude<T, null | undefined>; // Remove null and undefined from T

interface UpdateUserNotificationSettings {
  notificationSoundMode?: NonNullable<
    (typeof NotificationSoundMode)[keyof typeof NotificationSoundMode]
  >;
  notificationPingMode?: NonNullable<
    (typeof NotificationPingMode)[keyof typeof NotificationPingMode]
  >;
}

export async function updateUserNotificationSettings(
  userId: string,
  update: UpdateUserNotificationSettings,
  serverId?: string,
  channelId?: string
) {
  if (serverId && channelId)
    return [
      null,
      generateError('You must provide one of serverId or channelId.'),
    ] as const;

  if (!serverId && !channelId)
    return [null, generateError('ServerId or channelId is required.')] as const;

  const where: Prisma.UserNotificationSettingsWhereUniqueInput = channelId
    ? { userId_channelId: { userId, channelId } }
    : { userId_serverId: { userId, serverId: serverId! } };

  await prisma.userNotificationSettings.upsert({
    where,
    create: {
      id: generateId(),
      ...(channelId
        ? { userId, channelId }
        : {
            userId,
            serverId: serverId!,
            notificationPingMode: NotificationPingMode.ALL,
            notificationSoundMode: NotificationSoundMode.ALL,
          }),
      ...update,
    },
    update,
  });

  emitUserNotificationSettingsUpdate(userId, update, serverId, channelId);
  return [true, null] as const;
}

export async function registerFCMToken(accountId: string, token: string) {
  return await prisma.firebaseMessagingToken.upsert({
    where: {
      token,
    },
    update: {
      token,
      accountId,
    },
    create: {
      token,
      accountId,
    },
  });
}

export async function removeFCMTokens(tokens: string[]) {
  return await prisma.firebaseMessagingToken.deleteMany({
    where: { token: { in: tokens } },
  });
}

export async function getUserNotifications(userId: string) {
  const notifications = await prisma.messageNotification.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      server: true,
      serverMember: true,
      message: { include: MessageInclude },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (notifications.length) {
    const ids = notifications.map((n) => n.id);

    // delete older notifications.
    prisma.messageNotification
      .deleteMany({
        where: {
          NOT: { id: { in: ids } },
          userId,
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
      })
      .then(() => {});
  }

  return notifications;
}

export async function dismissUserNotice(noticeId: string, userId: string) {
  const notice = await prisma.userNotice.findFirst({
    where: {
      id: noticeId,
      userId
    }
  })

  if (!notice) {
    return [null, generateError('Notice not found')];
  }
  await prisma.userNotice.delete({
    where: {
      id: noticeId
    }
  })
  return [true, null];
}