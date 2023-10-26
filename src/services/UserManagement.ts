import { env } from "process";
import { prisma } from "../common/database";
import { generateError } from "../common/errorHandler";
import { sendConfirmCodeMail } from "../common/mailer";
import { generateEmailConfirmCode, generateTag } from "../common/random";
import { removeAccountCacheByUserIds } from "../cache/UserCache";
import { getIO } from "../socket/socket";
import { AUTHENTICATE_ERROR } from "../common/ClientEventNames";
import { DmStatus } from "./User";
import { checkUserPassword } from "./UserAuthentication";
import * as nerimityCDN from '../common/nerimityCDN';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import bcrypt from 'bcrypt';
import { deleteAllInboxCache } from "../cache/ChannelCache";
import { emitUserUpdated } from "../emits/User";
import { generateToken } from "../common/JWT";

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
  };
}

export const updateUser = async (opts: UpdateUserProps) => {
  const account = await getAccountByUserId(opts.userId);

  if (!account) {
    return [null, generateError('User does not exist!')] as const;
  }

  const isPasswordRequired = opts.tag || opts.email || opts.username || opts.newPassword?.trim();

  if (isPasswordRequired) {
    const isPasswordValid = await checkUserPassword(account.password, opts.password);

    if (!opts.password?.trim()) {
      return [null, generateError('Password is required.', 'password')] as const;
    }
    if (!isPasswordValid) {
      return [null, generateError('Invalid Password', 'password')] as const;
    }
  }

  const isUsernameOrTagUpdated = opts.username || opts.tag;

  if (isUsernameOrTagUpdated) {
    const usernameAndTagAlreadyExists = await prisma.user.findFirst({
      where: {
        tag: opts.tag?.trim() || account.user.tag,
        username: opts.username?.trim() || account.user.username,
        NOT: { id: opts.userId },
      },
    });

    if (usernameAndTagAlreadyExists) {
      return [
        null,
        generateError('Someone already has this combination of tag and username.'),
      ] as const;
    }
  }

  if (opts.email) {
    const accountExists = await prisma.account.findFirst({
      where: { email: opts.email.trim(), NOT: { userId: opts.userId } },
    });
    if (accountExists) {
      return [
        null,
        generateError('This email is already used by someone else.'),
      ];
    }
  }

  if (opts.avatar) {
    const [data, error] = await nerimityCDN.uploadAvatar({
      base64: opts.avatar,
      uniqueId: opts.userId,
      points: opts.avatarPoints
    });
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
      ...addToObjectIfExists('dmStatus', opts.dmStatus),
      ...(opts.newPassword?.trim()
        ? {
          password: await bcrypt.hash(opts.newPassword!.trim(), 10),
          passwordVersion: { increment: 1 },
        }
        : undefined),

      ...(opts.email && opts.email !== account.email
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

  return [{ user: updateResult.user, newToken }, null];
};

export async function sendEmailConfirmCode(userId: string) {
  const account = await getAccountByUserId(userId);

  if (!account) {
    return [null, generateError('Invalid userId.')] as const;
  }

  if (account.emailConfirmed) {
    return [null, generateError('Email already verified.')] as const;
  }

  const code = await updateAccountConfirmCode(userId);

  if (env.DEV_MODE) {
    return [{ message: `DEV MODE: Email verify code: ${code}` }, null] as const;
  }

  sendConfirmCodeMail(code, account.email);

  return [{ message: 'Email confirmation code sent.' }, null] as const;
}

const updateAccountConfirmCode = async (userId: string) => {
  const code = generateEmailConfirmCode();
  await prisma.account.update({
    where: { userId },
    data: { emailConfirmCode: code }
  });
  return code;
}

export async function verifyEmailConfirmCode(userId: string, code: string) {
  const account = await getAccountByUserId(userId);

  if (!account) {
    return [null, generateError('Invalid userId.')] as const;
  }

  if (account.emailConfirmed) {
    return [null, generateError('Email already verified.')] as const;
  }

  if (!account.emailConfirmCode) {
    return [
      null,
      generateError('You must request email verification first.'),
    ] as const;
  }

  if (account.emailConfirmCode !== code) {
    return [null, generateError('Invalid code.')] as const;
  }

  await updateAccountEmailConfirmed(userId);

  await removeAccountCacheByUserIds([userId]);
  return [true, null] as const;
}

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

const updateAccountEmailConfirmed = async (userId: string) => {
  const code = generateEmailConfirmCode();
  await prisma.account.update({
    where: { userId },
    data: {
      emailConfirmed: true,
      emailConfirmCode: null,
    }
  });
  return code;
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

  await deleteAccountFromDatabase(userId);

  await removeAccountCacheByUserIds([userId]);

  disconnectSockets(userId);

  return [true, null] as const;
}

const deleteAccountFromDatabase = async (userId: string) => {
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
    prisma.userDevice.deleteMany({ where: { userId } }),
  ]);
}

const disconnectSockets = (userId: string, excludeSocketId?: string) => {
  let broadcaster = getIO().in(userId);
  if (excludeSocketId) {
    broadcaster = broadcaster.except(excludeSocketId);
  }
  broadcaster.emit(AUTHENTICATE_ERROR, { message: 'Invalid Token' });
  broadcaster.disconnectSockets(true);
}