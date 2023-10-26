import bcrypt from 'bcrypt';
import { prisma } from "../common/database";
import { generateError } from "../common/errorHandler";
import { generateId } from "../common/flakeId";
import { generateHexColor, generateTag } from "../common/random";
import { generateToken } from '../common/JWT';
import { UserStatus } from '../types/User';

interface RegisterOpts {
  email: string;
  username: string;
  password: string;
}

export const registerUser = async (opts: RegisterOpts) => {
  const accountByEmail = await getAccountByEmail(opts.email)

  if (accountByEmail) {
    return [null, generateError('Email already exists.', 'email')] as const;
  }

  const tag = generateTag();
  const accountByUsernameAndTag = await getUserByUsernameAndTag(opts.username, tag)

  if (accountByUsernameAndTag) {
    return [
      null,
      generateError('This username is used too often. Try again.', 'username'),
    ] as const;
  }

  const hashedPassword = await bcrypt.hash(opts.password.trim(), 10);

  const newAccount = await prisma.account.create({
    data: {
      id: generateId(),
      email: opts.email,
      password: hashedPassword,
      passwordVersion: 0,
      user: {
        create: {
          id: generateId(),
          username: opts.username.trim(),
          tag,
          status: UserStatus.ONLINE,
          hexColor: generateHexColor(),
        },
      },
    },

    include: { user: true },
  });

  const userId = newAccount?.user?.id;

  const token = generateToken(userId, newAccount.passwordVersion);

  return [token, null] as const;
};

const getAccountByEmail = (email: string) => prisma.account.findFirst({
  where: { email: { equals: email, mode: 'insensitive' } },
  select: { id: true },
});

const getUserByUsernameAndTag = (username: string, tag: string) => prisma.user.findFirst({
  where: { username: { equals: username, mode: 'insensitive' }, tag },
})

interface LoginWithEmailOpts {
  email: string;
  password: string;
}
export const loginUserWithEmail = async (opts: LoginWithEmailOpts) => {
  const account = await prisma.account.findFirst({
    where: { email: { equals: opts.email, mode: 'insensitive' } },
    include: { user: true },
  });
  if (!account) {
    return [
      null,
      generateError('Invalid email address.', 'email'),
    ] as const;
  }
  return await loginUser({
    userId: account.user.id,
    passwordVersion: account.passwordVersion,
    inputPassword: opts.password,
    hashedPassword: account.password
  })
}

interface LoginWithUsernameAndTagOpts {
  username: string;
  tag: string;
  password: string;
}
export const loginWithUsernameAndTag = async (opts: LoginWithUsernameAndTagOpts) => {
  const account = await prisma.account.findFirst({
    where: { user: { username: opts.username, tag: opts.tag } },
    include: { user: true },
  });
  if (!account) {
    return [
      null,
      generateError('Invalid username/tag', 'email'),
    ] as const;
  }
  return await loginUser({
    userId: account.user.id,
    passwordVersion: account.passwordVersion,
    inputPassword: opts.password,
    hashedPassword: account.password
  })
}

interface LoginUserOpts {
  userId: string;
  passwordVersion: number;
  inputPassword: string;
  hashedPassword: string;
}
const loginUser = async (opts: LoginUserOpts) => {

  const isPasswordValid = await checkUserPassword(
    opts.hashedPassword,
    opts.inputPassword,
  );
  if (!isPasswordValid) {
    return [null, generateError('Invalid password.', 'password')] as const;
  }

  const token = generateToken(opts.userId, opts.passwordVersion);

  return [token, null] as const;
};

export const checkUserPassword = (hashedPassword: string, rawPassword?: string) =>
  !rawPassword ? false : bcrypt.compare(rawPassword, hashedPassword);