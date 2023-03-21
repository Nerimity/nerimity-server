import { UserStatus } from '../types/User';
import bcrypt from 'bcrypt';
import { generateHexColor, generateTag } from '../common/random';
import { generateToken } from '../common/JWT';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import { emitInboxOpened, emitUserPresenceUpdate, emitUserUpdated } from '../emits/User';
import { ChannelType } from '../types/Channel';
import { Presence, removeAccountsCache, updateCachePresence } from '../cache/UserCache';
import { FriendStatus } from '../types/Friend';
import {excludeFields, exists, prisma} from '../common/database';
import { generateId } from '../common/flakeId';
import { Account, Follower, User } from '@prisma/client';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { createPostNotification, fetchLatestPost, PostNotificationType } from './Post';
import * as nerimityCDN from '../common/nerimityCDN'; 
interface RegisterOpts {
  email: string;
  username: string;
  password: string;  
}


export const getSuspensionDetails = async (userId: string) => {
  const suspend = await prisma.suspension.findFirst({where: {userId}});
  if (!suspend) return false;
  if (!suspend.expireAt) return suspend;
  
  const expireDate = new Date(suspend.expireAt);
  const now = new Date();
  if (expireDate > now) return suspend;

  await prisma.suspension.delete({where: {userId}});
  return false;
};


export const registerUser = async (opts: RegisterOpts): Promise<CustomResult<string, CustomError>> => {

  const account = await exists(prisma.account, {where: {email: opts.email}});

  if (account) {
    return [null, generateError('Email already exists.', 'email')];
  }

  const tag = generateTag();
  const usernameTagExists = await prisma.user.findFirst({ where: {username: opts.username, tag} });
  if (usernameTagExists) {
    return [null, generateError('This username is used too often.', 'username')];
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

    include: {user: true}
  });


  const userId = newAccount?.user?.id as unknown as string;

  const token = generateToken(userId, newAccount.passwordVersion);

  return [token, null];
};

interface LoginOpts {
  email: string;
  password: string;
}

export const loginUser = async (opts: LoginOpts): Promise<CustomResult<string, CustomError>> => {
  const account = await prisma.account.findFirst({where: {email: opts.email}, include: {user: true}});
  if (!account) {
    return [null, generateError('Invalid email address.', 'email')];
  }

  const isPasswordValid = await checkUserPassword(opts.password, account.password);
  if (!isPasswordValid) {
    return [null, generateError('Invalid password.', 'password')];
  }
  const userId = account.user?.id as unknown as string;

  const token = generateToken(userId, account.passwordVersion);

  return [token, null];
};

export const checkUserPassword = async (password: string | undefined, encrypted: string): Promise<boolean> => !password ? false : bcrypt.compare(password, encrypted);



export const getAccountByUserId = (userId: string) => {
  return prisma.account.findFirst({where: {userId}, select: {...excludeFields('Account', ['password']), user: true}});
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
          recipientId: friendId
        },
        {
          createdById: friendId,
          recipientId: userId
        }
      ]
    }
  });


  if (inbox?.channelId) {
    const myInbox = await prisma.inbox.findFirst({where: { channelId: inbox.channelId, createdById: userId}, include: {channel: true, recipient: true}});
    if (myInbox) {
      if (myInbox.closed) {
        myInbox.closed = false;
        prisma.inbox.update({where: {id: myInbox.id}, data: {closed: false}});
        emitInboxOpened(userId, myInbox);
      }

      return [myInbox, null];
    }
  }

  const newChannel = inbox ? {id: inbox?.channelId} : await prisma.channel.create({data: {id: generateId(), type: ChannelType.DM_TEXT, createdById: userId }});
  
  const newInbox = await prisma.inbox.create({
    data: {
      id: generateId(),
      channelId: newChannel.id,
      createdById: userId,
      recipientId: friendId,
      closed: false,
    },
    include: {channel: true, recipient: true}
  });
  


  emitInboxOpened(userId, newInbox);

  return [newInbox, null];
  
};


export const updateUserPresence = async (userId: string, presence: Omit<Presence, 'userId'>) => {
  const user = await prisma.user.findFirst({where: {id: userId}});
  if (!user) {
    return [null, generateError('User not found.', 'user')];
  }

  await prisma.user.update({where: {id: userId}, data: {status: presence.status}});


  await updateCachePresence(userId, {status: presence.status, userId});

  emitUserPresenceUpdate(userId, { ...presence,  userId: user.id});

  return ['Presence updated.', null];

};


export const getUserDetails = async (requesterId: string, recipientId: string) => {
  const user = await prisma.user.findFirst({
    where: {id: recipientId},
    include: {
      followers: {where: {followedById: requesterId}, select: {followedToId: true}},
      following: {where: {followedById: requesterId}, select: {followedToId: true}},
      _count: {
        select: {
          followers: true,
          following: true,
          likedPosts: true,
          posts: {where: {deleted: null}},
        }
      }
    }
  });

  if (!user) {
    return [null, generateError('User not found.', 'user')];
  }

  // get mutual Friends
  const recipientFriends = await prisma.friend.findMany({where: { userId: recipientId, status: FriendStatus.FRIENDS }});
  const recipientFriendsIds = recipientFriends.map(friend => friend.recipientId);

  const mutualFriends = await prisma.friend.findMany({where: {userId: requesterId, recipientId: { in: recipientFriendsIds }}});
  const mutualFriendIds = mutualFriends.map(friend => friend.recipientId);

  // Get mutual servers
  const recipient = await prisma.user.findFirst({where: {id: recipientId}, select: {servers: {select: {id: true}}}});
  const recipientServerIds = recipient?.servers.map(server => server.id);

  const members = await prisma.serverMember.findMany({where: { userId: requesterId, serverId: { in: recipientServerIds } }});
  const mutualServerIds = members.map(member => member.serverId);


  // get latest post
  const latestPost = await fetchLatestPost(recipientId, requesterId);

  return [{user, mutualFriendIds, mutualServerIds, latestPost}, null];
};

interface UpdateUserProps {
  userId: string,
  email?: string,
  username?: string,
  tag?: string,
  password?: string
  avatar?: string
}

export const updateUser = async (opts: UpdateUserProps):  Promise<CustomResult<User, CustomError>> => {
  const account = await prisma.account.findFirst({
    where: { userId: opts.userId },
    select: {
      user: true,
      password: true
    }
  });

  if (!account) {
    return [null, generateError('User does not exist!')];
  }

  const isPasswordValid = await checkUserPassword(opts.password, account.password);
  if (!isPasswordValid) return [null, generateError('Invalid Password', 'password')];
  
  if (opts.tag || opts.username) {
    const exists = await prisma.user.findFirst({where: {
      tag: opts.tag?.trim() || account.user.tag,
      username: opts.username?.trim() || account.user.username,
      NOT: {id: opts.userId}
    }});
    if (exists) return [null, generateError('Someone already has this combination of tag and username.')];
  }

  if (opts.email) {
    const exists = await prisma.account.findFirst({where: {email: opts.email.trim(), NOT: {userId: opts.userId}}});
    if (exists) return [null, generateError('This email is already used by someone else.')];
  }


  if (opts.avatar) {
    const [data, error] = await nerimityCDN.uploadAvatar(opts.avatar, opts.userId);
    if (error) return [null, generateError(error)];
    if (data) {
      opts.avatar = data.path;
    }
  }


  const updateResult = await prisma.account.update({where: {userId: opts.userId}, data: {
    ...addToObjectIfExists('email', opts.email?.trim()),
    user: {
      update: {
        ...addToObjectIfExists('username', opts.username?.trim()),
        ...addToObjectIfExists('tag', opts.tag?.trim()),
        ...addToObjectIfExists('avatar', opts.avatar),
      }
    },
  },
  include: {user: true}
  });

  await removeAccountsCache([opts.userId]);

  emitUserUpdated(opts.userId, {
    email: updateResult.email,
    username: updateResult.user.username,
    tag: updateResult.user.tag,
    ...addToObjectIfExists('avatar', opts.avatar),
  });
  
  return [updateResult.user, null];
};



export async function followUser(requesterId: string, followToId: string): Promise<CustomResult<boolean, CustomError>> {
  // check if already following
  const existingFollow = await prisma.follower.findFirst({where: {followedById: requesterId, followedToId: followToId}});
  if (existingFollow) return [null, generateError('You are already following this user.')];

  await prisma.follower.create({
    data: {
      id: generateId(),
      followedById: requesterId,
      followedToId: followToId
    }
  });
  createPostNotification({
    type: PostNotificationType.FOLLOWED,
    byId: requesterId,
    toId: followToId,
  });
  return [true, null];

}

export async function unfollowUser(requesterId: string, unfollowId: string): Promise<CustomResult<boolean, CustomError>> {
  // check if already following
  const existingFollow = await prisma.follower.findFirst({where: {followedById: requesterId, followedToId: unfollowId}});
  if (!existingFollow) return [null, generateError('You are already not following this user.')];

  await prisma.follower.delete({where: {id: existingFollow.id}});
  return [true, null];
}


export async function followingUsers(userId: string) {
  const user = await prisma.user.findFirst({where: {id: userId}, select: {following: {select: {followedTo: true}}}});
  if (!user) return [null, generateError('invalid User')];
  return [user?.following.map(follower => follower.followedTo), null];
}

export async function followerUsers(userId: string) {
  const user = await prisma.user.findFirst({where: {id: userId}, select: {followers: {select: {followedBy: true}}}});
  if (!user) return [null, generateError('invalid User')];
  return [user?.followers.map(follower => follower.followedBy), null];
}