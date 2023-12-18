import { DmStatus } from "./User";
import { checkUserPassword } from "../UserAuthentication";
import * as nerimityCDN from '../../common/nerimityCDN';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import bcrypt from 'bcrypt';
import { deleteAllInboxCache } from "../../cache/ChannelCache";
import { emitUserUpdated } from "../../emits/User";
import { generateToken } from "../../common/JWT";
import { prisma } from "../../common/database";
import { removeAccountCacheByUserIds } from "../../cache/UserCache";
import { generateError } from "../../common/errorHandler";
import { disconnectSockets } from "./UserManagement";

interface UpdateUserProps {
  userId: string;
  socketId?: string;
  email?: string;
  username?: string;
  tag?: string;
  password?: string;
  newPassword?: string;
  avatar?: string;
  avatarPoints?: number[];
  banner?: string;
  dmStatus?: DmStatus;

  profile?: {
    bio?: string | null;
    pronouns?: string | null;
  };
}

export const updateUser = async (opts: UpdateUserProps) => {
  const account = await getAccountByUserId(opts.userId);

  if (!account) {
    return [null, generateError('User does not exist!')] as const;
  }

  const isPasswordRequired = checkPasswordRequired(opts);

  if (isPasswordRequired) {
    const passwordCheckResult = await checkPassword(account.password, opts.password);
    if (passwordCheckResult) return [null, passwordCheckResult] as const;
  }

  const isUsernameOrTagUpdated = checkUsernameOrTagUpdated(opts);

  if (isUsernameOrTagUpdated) {
    const usernameOrTagCheckResults = await checkUsernameOrTag({
      excludeUserId: opts.userId,
      oldUsername: account.user.username,
      oldTag: account.user.tag,
      newUsername: opts.username,
      newTag: opts.tag,
    })
    if (usernameOrTagCheckResults) return [null, usernameOrTagCheckResults] as const;
  }

  if (opts.email) {
    const accountExists = await prisma.account.findFirst({
      where: { email: opts.email.trim(), NOT: { userId: opts.userId } },
    });
    if (accountExists) {
      return [
        null,
        generateError('This email is already used by someone else.'),
      ] as const;
    }
  }

  if (opts.avatar) {
    const [data, error] = await nerimityCDN.uploadAvatar({
      base64: opts.avatar,
      uniqueId: opts.userId,
      points: opts.avatarPoints
    });
    if (error) return [null, generateError(error)] as const;
    if (data) {
      opts.avatar = data.path;
    }
  }

  if (opts.banner) {
    const [data, error] = await nerimityCDN.uploadBanner(
      opts.banner,
      opts.userId
    );
    if (error) return [null, generateError(error)] as const;
    if (data) {
      opts.banner = data.path;
    }
  }

  const updateResult = await updateAccountInDatabase(account.email, opts);

  if (opts.dmStatus !== undefined) {
    deleteAllInboxCache(opts.userId);
  }

  await removeAccountCacheByUserIds([opts.userId]);

  emitUserUpdated(opts.userId, {
    email: updateResult.email!,
    username: updateResult.user.username,
    tag: updateResult.user.tag,
    ...addToObjectIfExists('avatar', opts.avatar),
    ...addToObjectIfExists('banner', opts.banner),
    ...addToObjectIfExists('dmStatus', opts.dmStatus),
  });

  const newToken = opts.newPassword?.trim()
    ? generateToken(account.user.id, updateResult.passwordVersion)
    : undefined;

  if (newToken) {
    disconnectSockets(opts.userId, opts.socketId);
  }

  return [{ user: updateResult.user, newToken }, null] as const;
};

const getAccountByUserId = async (userId: string) => {
  return prisma.account.findFirst({
    where: { userId },
    select: {
      emailConfirmed: true,
      email: true,
      emailConfirmCode: true,
      user: true,
      password: true,
      passwordVersion: true,
    }
  });
};

const checkPasswordRequired = (opts: UpdateUserProps) => {
  return opts.tag || opts.email || opts.username || opts.newPassword?.trim();
}

const checkPassword = async (hashedPassword: string, rawPassword?: string) => {
  const isPasswordValid = await checkUserPassword(hashedPassword, rawPassword);

  if (!rawPassword?.trim()) {
    return generateError('Password is required.', 'password');
  }
  if (!isPasswordValid) {
    return generateError('Invalid Password', 'password');
  }
}

const checkUsernameOrTagUpdated = (opts: UpdateUserProps) => {
  return opts.username || opts.tag;
}

interface CheckUsernameOrTagOpts {
  excludeUserId: string;
  newUsername?: string;
  newTag?: string;
  oldUsername: string;
  oldTag: string
}
const checkUsernameOrTag = async (opts: CheckUsernameOrTagOpts) => {
  const userExists = await prisma.user.findFirst({
    where: {
      username: opts.newUsername?.trim() || opts.oldUsername,
      tag: opts.newTag?.trim() || opts.oldTag,
      NOT: { id: opts.excludeUserId },
    },
  });

  if (userExists) {
    return generateError('Someone already has this combination of tag and username.')
  }
}

const updateAccountInDatabase = async (email: string, opts: UpdateUserProps) => {

  return prisma.account.update({
    where: { userId: opts.userId },
    data: {
      ...addToObjectIfExists('email', opts.email?.trim()),
      ...addToObjectIfExists('dmStatus', opts.dmStatus),
      ...(opts.newPassword?.trim()
        ? {
          password: await bcrypt.hash(opts.newPassword!.trim(), 10),
          passwordVersion: { increment: 1 },
        }
        : undefined),

      ...(opts.email && opts.email !== email
        ? { emailConfirmed: false }
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
}