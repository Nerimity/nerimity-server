import { UserStatus } from '../types/User';
import bcrypt from 'bcrypt';
import { generateHexColor, generateTag } from '../common/random';
import { generateToken } from '../common/JWT';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import {
  emitInboxOpened,
  emitSelfPresenceUpdate,
  emitUserPresenceUpdate,
  emitUserServerSettingsUpdate,
  emitUserUpdated,
} from '../emits/User';
import { ChannelType } from '../types/Channel';
import {
  Presence,
  removeAccountCacheByUserIds,
  updateCachePresence,
} from '../cache/UserCache';
import { FriendStatus } from '../types/Friend';
import { excludeFields, exists, prisma } from '../common/database';
import { generateId } from '../common/flakeId';
import { Account, Follower, User } from '@prisma/client';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import {
  createPostNotification,
  fetchLatestPost,
  PostNotificationType,
} from './Post';
import * as nerimityCDN from '../common/nerimityCDN';
import { getIO } from '../socket/socket';
import { AUTHENTICATE_ERROR } from '../common/ClientEventNames';
interface RegisterOpts {
  email: string;
  username: string;
  password: string;
}

export const getSuspensionDetails = async (userId: string) => {
  const suspend = await prisma.suspension.findFirst({ where: { userId } });
  if (!suspend) return false;
  if (!suspend.expireAt) return suspend;

  const expireDate = new Date(suspend.expireAt);
  const now = new Date();
  if (expireDate > now) return suspend;

  await prisma.suspension.delete({ where: { userId } });
  return false;
};

export const registerUser = async (
  opts: RegisterOpts
): Promise<CustomResult<string, CustomError>> => {
  const account = await exists(prisma.account, {
    where: { email: { equals: opts.email, mode: 'insensitive' } },
  });

  if (account) {
    return [null, generateError('Email already exists.', 'email')];
  }

  const tag = generateTag();
  const usernameTagExists = await prisma.user.findFirst({
    where: { username: opts.username, tag },
  });
  if (usernameTagExists) {
    return [
      null,
      generateError('This username is used too often. Try again.', 'username'),
    ];
  }

  const hashedPassword = await bcrypt.hash(opts.password.trim(), 10);

  const newAccount = await prisma.account.create({
    data: {
      id: generateId(),
      email: opts.email,
      user: {
        create: {
          id: generateId(),
          username: opts.username.trim(),
          tag,
          status: UserStatus.ONLINE,
          hexColor: generateHexColor(),
        },
      },
      password: hashedPassword,
      passwordVersion: 0,
    },

    include: { user: true },
  });

  const userId = newAccount?.user?.id as unknown as string;

  const token = generateToken(userId, newAccount.passwordVersion);

  return [token, null];
};

interface LoginOpts {
  email?: string;
  username?: string;
  tag?: string;
  password: string;
}

export const loginUser = async (
  opts: LoginOpts
): Promise<CustomResult<string, CustomError>> => {
  const where = opts.email
    ? ({ email: { equals: opts.email, mode: 'insensitive' } } as const)
    : ({ user: { username: opts.username, tag: opts.tag } } as const);

  const account = await prisma.account.findFirst({
    where,
    include: { user: true },
  });
  if (!account) {
    return [
      null,
      generateError(
        opts.email ? 'Invalid email address.' : 'Invalid username/tag',
        'email'
      ),
    ];
  }

  const isPasswordValid = await checkUserPassword(
    opts.password,
    account.password!
  );
  if (!isPasswordValid) {
    return [null, generateError('Invalid password.', 'password')];
  }
  const userId = account.user?.id as unknown as string;

  const token = generateToken(userId, account.passwordVersion);

  return [token, null];
};

export const checkUserPassword = async (
  password: string | undefined,
  encrypted: string
): Promise<boolean> =>
  !password ? false : bcrypt.compare(password, encrypted);

export const getAccountByUserId = (userId: string) => {
  return prisma.account.findFirst({
    where: { userId },
    select: { ...excludeFields('Account', ['password']), user: true },
  });
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
      include: { channel: true, recipient: true },
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

      return [myInbox, null];
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

  const newInbox = await prisma.inbox.create({
    data: {
      id: generateId(),
      channelId: newChannel.id,
      createdById: userId,
      recipientId: friendId,
      closed: false,
    },
    include: {
      channel: { include: { _count: { select: { attachments: true } } } },
      recipient: true,
    },
  });

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

  return [newInbox, null];
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
  emitSelfPresenceUpdate(userId, emitPayload);
  if (shouldEmit) {
    emitUserPresenceUpdate(userId, emitPayload);
  }

  return ['Presence updated.', null];
};

export const getUserDetails = async (
  requesterId: string,
  recipientId: string
) => {
  const user = await prisma.user.findFirst({
    where: { id: recipientId },
    include: {
      followers: {
        where: { followedById: requesterId },
        select: { followedToId: true },
      },
      following: {
        where: { followedById: requesterId },
        select: { followedToId: true },
      },
      profile: { select: { bio: true } },
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
    where: { userId: requesterId, recipientId: { in: recipientFriendsIds } },
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

  // get latest post
  const latestPost = await fetchLatestPost(recipientId, requesterId);

  return [
    {
      user: { ...user, profile: undefined },
      mutualFriendIds,
      mutualServerIds,
      latestPost,
      profile: user.profile,
    },
    null,
  ];
};

interface UpdateUserProps {
  userId: string;
  socketId?: string;
  email?: string;
  username?: string;
  tag?: string;
  password?: string;
  newPassword?: string;
  avatar?: string;
  banner?: string;
  profile?: {
    bio?: string | null;
  };
}

export const updateUser = async (
  opts: UpdateUserProps
): Promise<CustomResult<{ user: User; newToken?: string }, CustomError>> => {
  const account = await prisma.account.findFirst({
    where: { userId: opts.userId },
    select: {
      user: true,
      password: true,
      passwordVersion: true,
    },
  });

  if (!account) {
    return [null, generateError('User does not exist!')];
  }

  if (opts.tag || opts.email || opts.username || opts.newPassword?.trim()) {
    const isPasswordValid = await checkUserPassword(
      opts.password,
      account.password!
    );
    if (!opts.password?.trim())
      return [null, generateError('Password is required.', 'password')];
    if (!isPasswordValid)
      return [null, generateError('Invalid Password', 'password')];
  }

  if (opts.tag || opts.username) {
    const exists = await prisma.user.findFirst({
      where: {
        tag: opts.tag?.trim() || account.user.tag,
        username: opts.username?.trim() || account.user.username,
        NOT: { id: opts.userId },
      },
    });
    if (exists)
      return [
        null,
        generateError(
          'Someone already has this combination of tag and username.'
        ),
      ];
  }

  if (opts.email) {
    const exists = await prisma.account.findFirst({
      where: { email: opts.email.trim(), NOT: { userId: opts.userId } },
    });
    if (exists)
      return [
        null,
        generateError('This email is already used by someone else.'),
      ];
  }

  if (opts.avatar) {
    const [data, error] = await nerimityCDN.uploadAvatar(
      opts.avatar,
      opts.userId
    );
    if (error) return [null, generateError(error)];
    if (data) {
      opts.avatar = data.path;
    }
  }

  if (opts.banner) {
    const [data, error] = await nerimityCDN.uploadBanner(
      opts.banner,
      opts.userId
    );
    if (error) return [null, generateError(error)];
    if (data) {
      opts.banner = data.path;
    }
  }

  const updateResult = await prisma.account.update({
    where: { userId: opts.userId },
    data: {
      ...addToObjectIfExists('email', opts.email?.trim()),
      ...(opts.newPassword?.trim()
        ? {
            password: await bcrypt.hash(opts.newPassword!.trim(), 10),
            passwordVersion: { increment: 1 },
          }
        : undefined),
      user: {
        update: {
          ...addToObjectIfExists('username', opts.username?.trim()),
          ...addToObjectIfExists('tag', opts.tag?.trim()),
          ...addToObjectIfExists('avatar', opts.avatar),
          ...addToObjectIfExists('banner', opts.banner),
          ...addToObjectIfExists('profile', opts.profile),
          ...(opts.profile
            ? {
                profile: {
                  upsert: {
                    create: opts.profile,
                    update: opts.profile,
                  },
                },
              }
            : undefined),
        },
      },
    },
    include: { user: true },
  });

  await removeAccountCacheByUserIds([opts.userId]);

  emitUserUpdated(opts.userId, {
    email: updateResult.email!,
    username: updateResult.user.username,
    tag: updateResult.user.tag,
    ...addToObjectIfExists('avatar', opts.avatar),
    ...addToObjectIfExists('banner', opts.banner),
  });

  const newToken = opts.newPassword?.trim()
    ? generateToken(account.user.id, updateResult.passwordVersion)
    : undefined;

  if (newToken) {
    let broadcaster = getIO().in(opts.userId);
    if (opts.socketId) {
      broadcaster = broadcaster.except(opts.socketId);
    }
    broadcaster.emit(AUTHENTICATE_ERROR, { message: 'Invalid Token' });
    broadcaster.disconnectSockets(true);
  }

  return [{ user: updateResult.user, newToken }, null];
};

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
    select: { following: { select: { followedTo: true } } },
  });
  if (!user) return [null, generateError('invalid User')];
  return [user?.following.map((follower) => follower.followedTo), null];
}

export async function followerUsers(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { followers: { select: { followedBy: true } } },
  });
  if (!user) return [null, generateError('invalid User')];
  return [user?.followers.map((follower) => follower.followedBy), null];
}

export enum ServerNotificationSoundMode {
  ALL = 0,
  MENTIONS_ONLY = 1,
  MUTE = 2,
}
export enum ServerNotificationPingMode {
  ALL = 0,
  MENTIONS_ONLY = 1,
  MUTE = 2,
}

interface UpdateServerSettings {
  notificationSoundMode?: ServerNotificationSoundMode;
  notificationPingMode?: ServerNotificationPingMode;
}

export async function UpdateServerSettings(
  userId: string,
  serverId: string,
  update: UpdateServerSettings
) {
  await prisma.serverMemberSettings.upsert({
    where: { userId_serverId: { userId, serverId } },
    create: {
      id: generateId(),
      serverId,
      userId,
      ...update,
    },
    update,
  });

  emitUserServerSettingsUpdate(userId, serverId, update);
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

export async function deleteAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      account: { select: { id: true } },
      _count: { select: { servers: true } },
    },
  });

  if (!user) {
    return [null, generateError('Invalid userId.')] as const;
  }

  if (user?._count.servers) {
    return [
      null,
      generateError('You must leave all servers before deleting your account.'),
    ] as const;
  }

  await prisma.$transaction([
    prisma.follower.deleteMany({
      where: {
        OR: [{ followedById: userId }, { followedToId: userId }],
      },
    }),
    prisma.userProfile.deleteMany({ where: { userId } }),
    prisma.serverChannelLastSeen.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        avatar: null,
        banner: null,
        badges: 0,

        customStatus: null,
        username: `Deleted Account ${generateTag()}`,
      },
    }),
    prisma.account.delete({
      where: { userId },
    }),
  ]);
  await removeAccountCacheByUserIds([userId]);

  const broadcaster = getIO().in(userId);
  broadcaster.emit(AUTHENTICATE_ERROR, { message: 'Invalid Token' });
  broadcaster.disconnectSockets(true);

  return [true, null] as const;
}
