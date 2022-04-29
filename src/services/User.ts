import { AccountModel } from '../models/AccountModel';
import { User, UserModel } from '../models/UserModel';
import bcrypt from 'bcrypt';
import { generateTag } from '../common/random';
import { generateToken } from '../common/JWT';
import { CustomError, generateError } from '../common/errorHandler';
import { CustomResult } from '../common/CustomResult';

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

  const hashedPassword = await bcrypt.hash(opts.password, 10);

  const newUser = await UserModel.create({
    username: opts.username,
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