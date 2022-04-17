import { AccountModel } from '../models/AccountModel';
import { UserModel } from '../models/UserModel';
import bcrypt from 'bcrypt';
import { generateTag } from '../common/random';
import { generateToken } from '../common/JWT';

interface RegisterOpts {
  email: string;
  username: string;
  password: string;  
}
type RegisterReturn = Promise<[string | null, {path: string, message: string} | null]>
export const registerUser = async (opts: RegisterOpts): RegisterReturn => {
  const account = await AccountModel.findOne({ email: opts.email });
  if (account) {
    return [null, {path: 'email', message: 'Email already exists'}];
  }

  const tag = generateTag();
  const usernameTagExists = await UserModel.exists({ username: opts.username, tag });
  if (usernameTagExists) {
    return [null, {path: 'username', message: 'This username is used too often.'}];
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

export const loginUser = async (opts: LoginOpts) => {
  const account = await AccountModel.findOne({ email: opts.email });
  if (!account) {
    return [null, {path: 'email', message: 'Invalid Email'}];
  }

  const isPasswordValid = await bcrypt.compare(opts.password, account.password);
  if (!isPasswordValid) {
    return [null, {path: 'password', message: 'Invalid Password'}];
  }

  const token = generateToken(account.user.toString(), account.passwordVersion);

  return [token, null];
};

