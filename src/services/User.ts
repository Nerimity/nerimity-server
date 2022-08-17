import { AccountModel } from '../models/AccountModel';
import { User, UserModel, UserStatus } from '../models/UserModel';
import bcrypt from 'bcrypt';
import { generateHexColor, generateTag } from '../common/random';
import { generateToken } from '../common/JWT';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import { emitInboxOpened, emitUserPresenceUpdate } from '../emits/User';
import { Channel, ChannelModel, ChannelType } from '../models/ChannelModel';
import { InboxModel } from '../models/InboxModel';
import { Presence, updateCachePresence } from '../cache/UserCache';
import { FriendModel, FriendStatus } from '../models/FriendModel';
import { ServerMemberModel } from '../models/ServerMemberModel';
import {excludeFields, exists, includeFields, prisma} from '../database';
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
      email: opts.email,
      user: {
        create: {
          username: opts.username.trim(),
          tag,
          status: UserStatus.ONLINE,
          hexColor: generateHexColor(),
        },
      },
      password: hashedPassword,
      passwordVersion: 0,
    },

    select: {
      ...excludeFields('Account', ['password']),
      user: true,
    }
  });


  const token = generateToken(newAccount?.user?.id as unknown as string, newAccount.passwordVersion);

  return [token, null];
};

interface LoginOpts {
  email: string;
  password: string;
}

export const loginUser = async (opts: LoginOpts): Promise<CustomResult<string, CustomError>> => {
  const account = await AccountModel.findOne({ email: opts.email });
  if (!account) {
    return [null, generateError('Invalid email address.', 'email')];
  }

  const isPasswordValid = await bcrypt.compare(opts.password, account.password);
  if (!isPasswordValid) {
    return [null, generateError('Invalid password.', 'password')];
  }

  const token = generateToken(account.user.toString(), account.passwordVersion);

  return [token, null];
};



export const getAccountByUserId = (userId: string) => {
  return AccountModel.findOne({user: userId}).populate<{user: User}>('user');
};

// this function is used to open a channel and inbox.
// if the recipient has not opened the channel, it will be created.
// if the recipient has opened the channel, we will create a new inbox with the existing channel id.
export const openDMChannel = async (userId: string, friendId: string) => {

  const inbox = await InboxModel.findOne({
    $or: [
      {
        createdBy: userId,
        recipient: friendId
      },
      {
        createdBy: friendId,
        recipient: userId
      }
    ]
  });


  if (inbox?.channel) {
    const myInbox = await InboxModel.findOne({ channel: inbox.channel, createdBy: userId }).populate<{channel: Channel}>('channel', '-createdBy').populate<{recipient: User}>('recipient');
    if (myInbox) {
      if (myInbox.closed) {
        myInbox.closed = false;
        await myInbox.save();
        emitInboxOpened(userId, myInbox.toObject({versionKey: false}));
      }

      return [myInbox.toObject({versionKey: false}), null];
    }
  }

  const newChannel = inbox ? {id: inbox?.channel} : await ChannelModel.create({ type: ChannelType.DM_TEXT, recipient: friendId, createdBy: userId });
  
  let newInbox = await InboxModel.create({
    channel: newChannel.id,
    createdBy: userId,
    recipient: friendId,
    closed: false,
  });

  newInbox = await newInbox.populate<{channel: Channel}>('channel', '-createdBy');
  newInbox = await newInbox.populate<{recipient: User}>('recipient');
  emitInboxOpened(userId, newInbox.toObject({versionKey: false}));

  return [newInbox.toObject({versionKey: false}), null];
  
};


export const updateUserPresence = async (userId: string, presence: Omit<Presence, 'userId'>) => {
  const user = await UserModel.findById(userId);
  if (!user) {
    return [null, generateError('User not found.', 'user')];
  }

  user.status = presence.status;
  await user.save();

  await updateCachePresence(userId, {status: presence.status, userId});

  emitUserPresenceUpdate(userId, { ...presence,  userId: user.id});

  return ['Presence updated.', null];

};


export const getUserDetails = async (requesterId: string, recipientId: string) => {
  const user = await UserModel.findById(recipientId);
  if (!user) {
    return [null, generateError('User not found.', 'user')];
  }

  // get mutual Friends
  const recipientFriends = await FriendModel.find({ user: recipientId, status: FriendStatus.FRIENDS });
  const recipientFriendsIds = recipientFriends.map(friend => friend.recipient);
  const mutualFriends = await FriendModel.find({ user: requesterId, recipient: { $in: recipientFriendsIds } });
  const mutualFriendIds = mutualFriends.map(friend => friend.recipient);

  // Get mutual servers
  const recipientServers = (await UserModel.findById(recipientId).select('servers'))?.servers;
  const members = await ServerMemberModel.find({ user: requesterId, server: { $in: recipientServers } });
  const mutualServerIds = members.map(member => member.server);

  return [{user: user.toObject({versionKey: false}), mutualFriendIds, mutualServerIds}, null];



};