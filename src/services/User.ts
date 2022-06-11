import { AccountModel } from '../models/AccountModel';
import { User, UserModel } from '../models/UserModel';
import bcrypt from 'bcrypt';
import { generateTag } from '../common/random';
import { generateToken } from '../common/JWT';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';
import { emitInboxOpened } from '../emits/User';
import { Channel, ChannelModel, ChannelType } from '../models/ChannelModel';
import { InboxModel } from '../models/InboxModel';

interface RegisterOpts {
  email: string;
  username: string;
  password: string;  
}

export const registerUser = async (opts: RegisterOpts): Promise<CustomResult<string, CustomError>> => {
  const account = await AccountModel.findOne({ email: opts.email });
  if (account) {
    return [null, generateError('Email already exists.', 'email')];
  }

  const tag = generateTag();
  const usernameTagExists = await UserModel.exists({ username: opts.username, tag });
  if (usernameTagExists) {
    return [null, generateError('This username is used too often.', 'username')];
  }

  const hashedPassword = await bcrypt.hash(opts.password.trim(), 10);

  const newUser = await UserModel.create({
    username: opts.username.trim(),
    tag
  });

  const newAccount = await AccountModel.create({
    email: opts.email,
    user: newUser._id,
    password: hashedPassword,
    passwordVersion: 0,
  });

  newUser.account = newAccount._id;
  await newUser.save();

  const token = generateToken(newUser.id, newAccount.passwordVersion);

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

  const channel = await ChannelModel.findOne({ 
    $or: [
      {
        type: ChannelType.DM_TEXT,
        recipients: { $eq: [userId, friendId], $size: 2}
      },
      {
        type: ChannelType.DM_TEXT,
        recipients: { $eq: [friendId, userId], $size: 2}
      }
    ]
  }).select('_id');


  if (channel) {
    const inbox = await InboxModel.findOne({ channel: channel.id, user: userId }).populate<{channel: Channel & {recipients: User[]}}>({ path: 'channel', select: '_id', populate: { path: 'recipients' } });
    if (inbox) {
      if (inbox.closed) {
        inbox.closed = false;
        await inbox.save();
        emitInboxOpened(userId, inbox.toObject({versionKey: false}));
      }

      return [inbox.toObject({versionKey: false}), null];
    }
  }

  const newChannel = channel || await ChannelModel.create({ type: ChannelType.DM_TEXT, recipients: [userId, friendId], createdBy: userId });
  
  let newInbox = await InboxModel.create({
    channel: newChannel.id,
    user: userId,
    closed: false,
  });

  newInbox = await newInbox.populate<{channel: Channel & {recipients: User[]}}>({ path: 'channel', populate: { path: 'recipients' } });
  emitInboxOpened(userId, newInbox.toObject({versionKey: false}));

  return [newInbox.toObject({versionKey: false}), null];
  
};