import { prisma, publicUserExcludeFields } from '../common/database';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { generateHexColor, generateTag } from '../common/random';
import { UserStatus } from '../types/User';
import { checkUsernameOrTag, checkUsernameOrTagUpdated } from './User/updateUser';
import * as nerimityCDN from '../common/nerimityCDN';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { emitUserUpdated } from '../emits/User';
import { generateToken } from '../common/JWT';
import { deleteAccount, disconnectSockets } from './User/UserManagement';
import { removeUserCacheByUserIds } from '../cache/UserCache';
import { BotCommand } from '@prisma/client';

export async function createApplication(requesterAccountId: string) {
  const count = await prisma.application.count({
    where: { creatorAccountId: requesterAccountId },
  });

  if (count >= 10) {
    return [null, generateError('You already created the maximum amount of applications!')] as const;
  }

  const application = await prisma.application.create({
    data: {
      id: generateId(),
      name: 'Untitled ' + (count + 1),
      creatorAccountId: requesterAccountId,
    },
  });

  return [application, null] as const;
}

export async function getApplications(requesterAccountId: string) {
  const applications = await prisma.application.findMany({
    where: { creatorAccountId: requesterAccountId },
  });

  return [applications, null] as const;
}

export async function updateApplication(
  requesterAccountId: string,
  id: string,
  update: {
    name?: string;
  }
) {
  const app = await prisma.application.findUnique({
    where: { creatorAccountId: requesterAccountId, id },
  });

  if (!app) {
    return [null, generateError('Application not found!')] as const;
  }

  const sanitizedUpdate = {
    ...addToObjectIfExists('name', update.name?.trim()),
  };

  const application = await prisma.application.update({
    where: { id },
    data: sanitizedUpdate,
  });

  return [{ ...sanitizedUpdate, id: application.id }, null] as const;
}

export async function applicationExists(appId: string) {
  const application = await prisma.application.findUnique({
    where: { id: appId },
    select: { id: true },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }

  return [true, null] as const;
}

export async function getApplication(requesterAccountId: string, id: string) {
  const application = await prisma.application.findUnique({
    where: { creatorAccountId: requesterAccountId, id },
    include: { botUser: true },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }

  return [application, null] as const;
}

export async function deleteApplication(accountId: string, appId: string) {
  const [app, error] = await getApplication(accountId, appId);

  if (error) {
    return [null, error] as const;
  }

  if (app.botUserId) {
    const [, deleteAccountError] = await deleteAccount(app.botUserId, { bot: true, deleteContent: true });
    if (deleteAccountError) {
      return [null, deleteAccountError] as const;
    }
  }
  await prisma.application.delete({ where: { id: appId } });

  return [true, null] as const;
}

export async function getBotToken(requesterAccountId: string, appId: string) {
  const application = await prisma.application.findUnique({
    where: { creatorAccountId: requesterAccountId, id: appId },
    select: { botTokenVersion: true, botUserId: true },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }
  if (!application.botUserId) {
    return [null, generateError('Application does not have a bot!')] as const;
  }

  const token = generateToken(application.botUserId, application.botTokenVersion);

  return [token, null] as const;
}

export async function getApplicationBot(appId: string, opts?: { includeCreator?: boolean }) {
  const application = await prisma.application.findUnique({
    where: { id: appId },

    include: {
      botUser: {
        select: {
          ...publicUserExcludeFields,
          ...(opts?.includeCreator
            ? {
                application: {
                  select: {
                    creatorAccount: {
                      select: { user: { select: publicUserExcludeFields } },
                    },
                  },
                },
              }
            : {}),
        },
      },
    },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }
  if (!application.botUser) {
    return [null, generateError('Application does not have a bot!')] as const;
  }

  return [application.botUser, null] as const;
}

export async function createBot(applicationId: string, requesterAccountId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId, creatorAccountId: requesterAccountId },
    include: {
      creatorAccount: { select: { user: { select: { username: true } } } },
    },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }

  if (application.botUserId) {
    return [null, generateError('This application already has a bot!')] as const;
  }

  const botUser = await prisma.user.create({
    data: {
      id: generateId(),
      username: `Untitled Bot ${generateTag()}`,
      tag: generateTag(),
      status: UserStatus.ONLINE,
      hexColor: generateHexColor(),
      bot: true,
    },
  });
  await prisma.application.update({
    where: { id: application.id },
    data: { botUserId: botUser.id },
  });

  return [botUser, null] as const;
}

interface UpdateBotProps {
  userId: string;
  username?: string;
  tag?: string;
  avatar?: string;
  avatarPoints?: number[];
  banner?: string;

  profile?: {
    bio?: string | null;
  };
}

export const updateBot = async (opts: UpdateBotProps) => {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
  });

  if (!user?.bot) {
    return [null, generateError('User is not a bot!')] as const;
  }

  if (!user) {
    return [null, generateError('Bot does not exist!')] as const;
  }

  const isUsernameOrTagUpdated = checkUsernameOrTagUpdated(opts);

  if (isUsernameOrTagUpdated) {
    const usernameOrTagCheckResults = await checkUsernameOrTag({
      excludeUserId: opts.userId,
      oldUsername: user.username,
      oldTag: user.tag,
      newUsername: opts.username,
      newTag: opts.tag,
    });
    if (usernameOrTagCheckResults) return [null, usernameOrTagCheckResults] as const;
  }

  const updateResult = await updateBotInDatabase(opts);

  await removeUserCacheByUserIds([opts.userId]);

  emitUserUpdated(opts.userId, {
    username: updateResult.username,
    tag: updateResult.tag,
    ...addToObjectIfExists('avatar', opts.avatar),
    ...addToObjectIfExists('banner', opts.banner),
  });

  return [updateResult, null] as const;
};

const updateBotInDatabase = async (opts: UpdateBotProps) => {
  return prisma.user.update({
    where: { id: opts.userId },
    data: {
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
    include: { profile: { select: { bio: true, bgColorOne: true, bgColorTwo: true, primaryColor: true } } },
  });
};

export async function refreshBotToken(requesterAccountId: string, appId: string) {
  const application = await prisma.application.findUnique({
    where: { creatorAccountId: requesterAccountId, id: appId },
    select: { botTokenVersion: true, botUserId: true },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }
  if (!application.botUserId) {
    return [null, generateError('Application does not have a bot!')] as const;
  }

  await prisma.application.update({
    where: { id: appId },
    data: { botTokenVersion: { increment: 1 } },
  });

  await removeUserCacheByUserIds([application.botUserId]);
  disconnectSockets(application.botUserId);

  return [true, null] as const;
}

interface UpdateBotCommandsOpts {
  applicationId: string;
  commands: {
    name: string;
    description?: string;
    args?: string;
  }[];
}

export async function updateBotCommands(opts: UpdateBotCommandsOpts) {
  const application = await prisma.application.findUnique({
    where: { id: opts.applicationId },
    select: { botUserId: true },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }
  if (!application.botUserId) {
    return [null, generateError('Application does not have a bot!')] as const;
  }

  await prisma.$transaction([
    prisma.botCommand.deleteMany({ where: { applicationId: opts.applicationId } }),
    prisma.botCommand.createMany({
      data: opts.commands.map((c) => ({
        id: generateId(),
        applicationId: opts.applicationId,
        botUserId: application.botUserId!,
        name: c.name,
        description: c.description,
        args: c.args,
      })),
      skipDuplicates: true,
    }),
  ]);
  return [true, null] as const;
}

export async function getServerBotCommands(serverId: string) {
  const commands = await prisma.botCommand.findMany({
    select: {
      botUserId: true,
      name: true,
      description: true,
      args: true,
    },
    orderBy: { name: 'asc' },
    where: {
      application: {
        botUser: {
          memberInServers: {
            some: {
              serverId,
            },
          },
        },
      },
    },
  });

  return commands;
}
