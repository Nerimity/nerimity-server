import { AccountModel } from "../models/AccountModel";
import { UserModel } from "../models/UserModel";

interface RegisterOpts {
  email: string;
  username: string;
  password: string;  
}

export const registerUser = async (opts: RegisterOpts) => {
  const account = await AccountModel.findOne({ email: opts.email });
  if (account) {
    return [null, "User with this email already exists."];
  }

  const newUser = await UserModel.create({
    username: opts.username,
    tag: '0000'
  });

  const newAccount = await AccountModel.create({
    email: opts.email,
    user: newUser._id,
    password: opts.password,
  });

  newUser.account = newAccount._id;
  await newUser.save();
}