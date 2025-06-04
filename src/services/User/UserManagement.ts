import { dateToDateTime, prisma, removeServerIdFromFolders } from '../../common/database';
import { generateError } from '../../common/errorHandler';
import { sendConfirmCodeMail, sendResetPasswordMail } from '../../common/mailer';
import { generateEmailConfirmCode, generateHexColor, generateSecureCode, generateTag } from '../../common/random';
import { getUserPresences, removeUserCacheByUserIds } from '../../cache/UserCache';
import { getIO } from '../../socket/socket';
import { AUTHENTICATE_ERROR } from '../../common/ClientEventNames';
import bcrypt from 'bcrypt';
import { generateToken } from '../../common/JWT';
import env from '../../common/env';
import { deleteServer, leaveServer } from '../Server';
import { setTimeout as setPromiseTimeout } from 'timers/promises';
import { deleteApplication } from '../Application';
import { createHash } from 'crypto';
import { generateId } from '../../common/flakeId';
import { ShadowBan } from '@prisma/client';
import { encrypt } from '../../common/encryption';
import path from 'path';
import { emitServerFolderCreated, emitServerFolderUpdated, emitServerOrderUpdated } from '../../emits/Server';

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

  const result = await sendConfirmCodeMail(code, account.email).catch(() => false);

  if (!result) {
    return [null, generateError('Failed to send email. Daily limit exceeded.')] as const;
  }

  return [{ message: 'Email confirmation code sent.' }, null] as const;
}

const updateAccountConfirmCode = async (userId: string) => {
  const code = generateEmailConfirmCode();
  await prisma.account.update({
    where: { userId },
    data: { emailConfirmCode: code },
  });
  return code;
};

export async function sendResetPasswordCode(email: string) {
  const account = await prisma.account.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  if (!account) {
    return [null, generateError('Invalid email.')] as const;
  }

  const code = await updateForgotPasswordCode(account.userId);
  const url = `${env.CLIENT_URL}/reset-password?code=${code}&userId=${account.userId}`;

  if (env.DEV_MODE) {
    return [{ message: `DEV MODE: Password reset link: ${url}` }, null] as const;
  }

  const result = await sendResetPasswordMail(url, account.email).catch(() => false);

  if (!result) {
    return [null, generateError('Failed to send email. Daily limit exceeded.')] as const;
  }

  return [{ message: 'Password reset link sent to your email.' }, null] as const;
}

const updateForgotPasswordCode = async (userId: string) => {
  const code = generateSecureCode();

  await prisma.account.update({
    where: { userId },
    data: {
      resetPasswordCode: code,
      resetPasswordCodeExpiresAt: dateToDateTime(new Date(Date.now() + 60 * 60 * 1000)), // expires in 1 hour
    },
  });
  return code;
};

export async function verifyEmailConfirmCode(userId: string, code: string) {
  const account = await getAccountByUserId(userId);

  if (!account) {
    return [null, generateError('Invalid userId.')] as const;
  }

  if (account.emailConfirmed) {
    return [null, generateError('Email already verified.')] as const;
  }

  if (!account.emailConfirmCode) {
    return [null, generateError('You must request email verification first.')] as const;
  }

  if (account.emailConfirmCode !== code) {
    return [null, generateError('Invalid code.')] as const;
  }

  await updateAccountEmailConfirmed(userId);

  await removeUserCacheByUserIds([userId]);
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
    },
  });
};

const updateAccountEmailConfirmed = async (userId: string) => {
  const code = generateEmailConfirmCode();
  await prisma.account.update({
    where: { userId },
    data: {
      emailConfirmed: true,
      emailConfirmCode: null,
    },
  });
  return code;
};

export async function deleteAllApplications(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      account: {
        select: {
          id: true,
          applications: { select: { id: true } },
        },
      },
    },
  });
  if (!user?.account) return [null, generateError('Invalid userId.')] as const;

  for (let i = 0; i < user.account.applications.length; i++) {
    await setPromiseTimeout(500);
    const application = user.account.applications[i]!;
    await deleteApplication(user.account.id, application.id);
  }

  return [true, null] as const;
}
export async function deleteOrLeaveAllServers(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      servers: { select: { id: true, createdById: true } },
    },
  });

  if (!user) return [null, generateError('Invalid userId.')] as const;

  for (let i = 0; i < user.servers.length; i++) {
    await setPromiseTimeout(500);
    const server = user.servers[i]!;
    if (server.createdById === userId) {
      await deleteServer(server.id, userId);
      continue;
    }
    await leaveServer(userId, server.id);
  }

  return [true, null] as const;
}

export interface DeleteAccountOptions {
  bot?: boolean;
  deleteContent?: boolean;
}

export async function deleteAccount(userId: string, opts?: DeleteAccountOptions) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      shadowBan: true,
      account: {
        select: { id: true, email: true, _count: { select: { applications: true } } },
      },
      application: { select: { id: true } },
      _count: { select: { servers: true } },
    },
  });

  if (!user) {
    return [null, generateError('Invalid userId.')] as const;
  }

  if (!user?.application && !user?.account) {
    return [true, null] as const;
  }

  if (!opts?.bot) {
    if (user?._count.servers) {
      return [null, generateError('You must leave all servers before deleting your account.')] as const;
    }
    if (user?.account?._count.applications) {
      return [null, generateError('You must delete all applications before deleting your account.')] as const;
    }
  }

  await deleteAccountFromDatabase(userId, { ...opts, shadowBan: user?.shadowBan, email: user?.account?.email });

  await removeUserCacheByUserIds([userId]);

  disconnectSockets(userId);

  return [true, null] as const;
}

const deleteAccountFromDatabase = async (userId: string, opts?: DeleteAccountOptions & { shadowBan?: ShadowBan; email?: string }) => {
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
        username: `Deleted ${opts?.bot ? 'Bot' : 'User'} ${generateTag()}`,
      },
    }),
    ...(opts?.deleteContent
      ? [
          prisma.scheduleAccountContentDelete.upsert({
            where: { userId },
            create: { userId },
            update: { userId },
          }),
        ]
      : []),
    prisma.account.deleteMany({
      where: { userId },
    }),
    prisma.userDevice.deleteMany({ where: { userId } }),
    prisma.userConnection.deleteMany({ where: { userId } }),
    prisma.chatNotice.deleteMany({ where: { userId } }),
    prisma.userNotice.deleteMany({ where: { userId } }),
    ...(opts?.shadowBan && opts?.email
      ? [
          prisma.shadowBan.deleteMany({ where: { id: opts.shadowBan.id } }),
          prisma.suspension.create({
            data: {
              userId,
              userDeleted: true,
              emailHash: createHash('sha256').update(opts.email).digest('hex'),
              id: generateId(),
              suspendedById: opts.shadowBan.bannedById,
            },
          }),
        ]
      : []),
  ]);
};

export const disconnectSockets = (userId: string, excludeSocketId?: string) => {
  let broadcaster = getIO().in(userId);
  if (excludeSocketId) {
    broadcaster = broadcaster.except(excludeSocketId);
  }
  broadcaster.emit(AUTHENTICATE_ERROR, { message: 'Invalid Token' });
  broadcaster.disconnectSockets(true);
};

export const resetPassword = async (opts: { userId: string; code: string; newPassword: string }) => {
  if (!opts.code) {
    return [null, generateError('Invalid code.')] as const;
  }
  if (!opts.newPassword) {
    return [null, generateError('Invalid password.')] as const;
  }
  if (!opts.userId) {
    return [null, generateError('Invalid userId.')] as const;
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: opts.userId,
      resetPasswordCode: opts.code,
      resetPasswordCodeExpiresAt: { gte: new Date() },
    },
  });

  if (!account) {
    return [null, generateError('Invalid or expired code.')] as const;
  }

  const updateResult = await prisma.account.update({
    where: { userId: opts.userId },
    data: {
      password: await bcrypt.hash(opts.newPassword.trim(), 10),
      passwordVersion: { increment: 1 },
      resetPasswordCode: null,
      resetPasswordCodeExpiresAt: null,
    },
  });
  await removeUserCacheByUserIds([opts.userId]);

  const newToken = generateToken(account.userId, updateResult.passwordVersion);

  if (newToken) {
    disconnectSockets(opts.userId);
  }

  return [newToken, null] as const;
};

export const ExternalEmbedType = {
  SERVER: 0,
  USER: 1,
} as const;

interface CreateExternalEmbedProps {
  type: (typeof ExternalEmbedType)[keyof typeof ExternalEmbedType];
  serverId?: string;
  serverInviteId?: string;
  userId?: string;
}

export const createExternalEmbed = async (opts: CreateExternalEmbedProps) => {
  if (opts.serverId && opts.userId) {
    return [null, generateError('Only one of serverId or userId can be provided.')] as const;
  }

  if (opts.type === ExternalEmbedType.SERVER) {
    if (!opts.serverId) {
      return [null, generateError('serverId is required.')] as const;
    }
    if (!opts.serverInviteId) {
      return [null, generateError('serverInviteId is required.')] as const;
    }
    const invite = await prisma.serverInvite.findUnique({
      where: { code: opts.serverInviteId, serverId: opts.serverId },
    });
    if (!invite) {
      return [null, generateError('Invalid invite code.')] as const;
    }
  }
  if (opts.type === ExternalEmbedType.USER && !opts.userId) {
    return [null, generateError('UserId is required.')] as const;
  }

  const existingEmbed = await prisma.externalEmbed.findFirst({
    where: {
      OR: [{ serverId: opts.serverId }, { userId: opts.userId }],
    },
  });
  if (existingEmbed) {
    return [null, generateError('Embed already exists.')] as const;
  }

  const externalEmbed = await prisma.externalEmbed.create({
    data: {
      id: generateId(),
      type: opts.type,
      serverId: opts.serverId!,
      serverInviteCode: opts.serverInviteId,
      userId: opts.userId,
    },
  });

  return [externalEmbed, null] as const;
};

export const deleteExternalEmbed = async (opts: { userId?: string; serverId?: string }) => {
  const externalEmbed = await prisma.externalEmbed.delete({
    where: {
      serverId: opts.serverId,
      userId: opts.userId,
    },
  });
  if (!externalEmbed) {
    return [null, generateError('Embed not found.')] as const;
  }

  return [true, null] as const;
};

export const getRawExternalEmbed = async (opts: { serverId?: string; userId?: string }) => {
  const externalEmbed = await prisma.externalEmbed.findUnique({
    where: {
      serverId: opts.serverId,
      userId: opts.userId,
    },
  });
  if (!externalEmbed) {
    return [null, generateError('Embed not found.')] as const;
  }

  return [externalEmbed, null] as const;
};

export const getExternalEmbed = async (opts: { serverId?: string; userId?: string }) => {
  const externalEmbed = await prisma.externalEmbed.findUnique({
    where: {
      serverId: opts.serverId,
      userId: opts.userId,
    },
    select: {
      id: true,
      userId: true,
      serverInviteCode: true,
      server: {
        select: {
          avatar: true,
          hexColor: true,
          banner: true,
          name: true,
          verified: true,
          serverMembers: {
            orderBy: [{ nickname: 'asc' }, { user: { username: 'asc' } }],
            select: {
              nickname: true,
              user: {
                select: {
                  id: true,
                  hexColor: true,
                  username: true,
                  avatar: true,
                  bot: true,
                  banner: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!externalEmbed) {
    return [null, generateError('Embed not found.')] as const;
  }

  if (externalEmbed.server) {
    const presence = await getUserPresences(externalEmbed.server.serverMembers.map((member) => member.user.id));
    const data = {
      ...externalEmbed,
      onlineMembersCount: presence.length,
      server: {
        ...externalEmbed.server,
        serverMembers: null,
      },
      users: externalEmbed.server.serverMembers
        .filter((member) => !member.user.bot)
        .sort((a, b) => {
          const presenceA = presence.find((presence) => presence.userId === a.user.id)!;
          const presenceB = presence.find((presence) => presence.userId === b.user.id)!;

          if (presenceA && presenceB) {
            return 0;
          }

          if (presenceA) {
            return -1;
          }

          if (presenceB) {
            return 1;
          }

          return 0;
        })
        .slice(0, 50)
        .map((m, i) => {
          const p = presence.find((presence) => presence.userId === m.user.id)!;
          const bannerExtName = m.user.banner ? path.extname(m.user.banner) : undefined;
          const avatarEtxName = m.user.avatar ? path.extname(m.user.avatar) : undefined;
          return {
            ...{
              avatar: m.user.avatar ? encrypt(m.user.avatar, env.EXTERNAL_EMBED_SECRET) + avatarEtxName : null,
              banner: m.user.banner ? encrypt(m.user.banner, env.EXTERNAL_EMBED_SECRET) + bannerExtName : null,
              hexColor: m.user.hexColor,
              username: m.nickname || m.user.username,
              id: i,
            },
            presence: !p
              ? null
              : {
                  custom: p.custom,
                  status: p.status,
                  activity: p.activity
                    ? {
                        name: p.activity.name,
                        title: p.activity.title,
                        action: p.activity.action,
                        imgSrc: p.activity.imgSrc,
                      }
                    : null,
                },
          };
        }),
    };
    return [data, null] as const;
  }

  return [externalEmbed, null] as const;
};

export const createServerFolder = async (opts: { name: string; accountId: string; userId: string; serverIds: string[] }) => {
  const areServerIdsValid = (await prisma.server.count({ where: { id: { in: opts.serverIds }, serverMembers: { some: { userId: opts.userId } } } })) === opts.serverIds.length;

  if (!areServerIdsValid) {
    return [null, generateError('Invalid server ids.')] as const;
  }

  const account = await prisma.account.findUnique({ where: { id: opts.accountId }, select: { serverOrderIds: true } });
  if (!account) {
    return [null, generateError('Invalid account id.')] as const;
  }

  const serverOrderIds = account.serverOrderIds;

  const folderFirstServerId = opts.serverIds[0];

  const indexOfFirstServer = serverOrderIds.indexOf(folderFirstServerId!);
  if (indexOfFirstServer === -1) {
    return [null, generateError('Invalid server ids.')] as const;
  }

  return prisma.$transaction(async (tx) => {
    const folder = await tx.serverFolder.create({
      data: {
        id: generateId(),
        name: opts.name,
        accountId: opts.accountId,
        color: generateHexColor(),
        serverIds: opts.serverIds,
      },
      select: {
        id: true,
        name: true,
        color: true,
        serverIds: true,
      },
    });

    // add folder above first folder server id
    serverOrderIds.splice(indexOfFirstServer, 0, folder.id);

    await tx.account.update({ where: { id: opts.accountId }, data: { serverOrderIds: serverOrderIds } });

    emitServerOrderUpdated(opts.userId, serverOrderIds);
    emitServerFolderCreated(opts.userId, folder);

    return [folder, null] as const;
  });
};

interface UpdateServerFolderOptions {
  userId: string;
  name?: string;
  color?: string;
  serverIds?: string[];
}

export const updateServerFolder = async (folderId: string, opts: UpdateServerFolderOptions) => {
  const { userId, ...updateFolder } = opts;

  if (opts.serverIds?.length) {
    const areServerIdsValid = (await prisma.server.count({ where: { id: { in: opts.serverIds }, serverMembers: { some: { userId } } } })) === opts.serverIds.length;

    if (!areServerIdsValid) {
      return [null, generateError('Invalid server ids.')] as const;
    }
  }

  if (opts.serverIds && !opts.serverIds.length) {
    const folder = await prisma.serverFolder.delete({ where: { id: folderId }, select: { id: true, name: true, color: true, serverIds: true } }).catch(() => undefined);

    if (!folder) return [null, generateError('Invalid folder id.')] as const;

    emitServerFolderUpdated(userId, { ...folder, serverIds: [] });

    return [folder, null] as const;
  }

  const updatedFolder = await prisma.serverFolder.update({ where: { id: folderId, account: { userId: opts.userId } }, data: updateFolder, select: { id: true, name: true, color: true, serverIds: true } }).catch(() => undefined);

  if (!updatedFolder) return [null, generateError('Invalid folder id.')] as const;

  emitServerFolderUpdated(userId, updatedFolder);

  return [updatedFolder, null] as const;
};
