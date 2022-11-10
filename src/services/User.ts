import { UserStatus } from '../types/User';
import bcrypt from 'bcrypt';
import { generateHexColor, generateTag } from '../common/random';
import { generateToken } from '../common/JWT';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import { emitInboxOpened, emitUserPresenceUpdate } from '../emits/User';
import { ChannelType } from '../types/Channel';
import { Presence, updateCachePresence } from '../cache/UserCache';
import { FriendStatus } from '../types/Friend';
import {excludeFields, exists, prisma} from '../common/database';
import { generateId } from '../common/flakeId';
interface RegisterOpts {
  email: string;
  username: string;
  password: string;  
}

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

export const checkUserPassword = (password: string, encrypted: string): Promise<boolean> => bcrypt.compare(password, encrypted);



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
  const user = await prisma.user.findFirst({where: {id: recipientId}});

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

  return [{user, mutualFriendIds, mutualServerIds}, null];



};