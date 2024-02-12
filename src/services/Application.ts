import { prisma } from '../common/database';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { generateHexColor, generateTag } from '../common/random';
import { UserStatus } from '../types/User';
import { checkUsernameOrTag, checkUsernameOrTagUpdated } from './User/updateUser';
import * as nerimityCDN from '../common/nerimityCDN';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { emitUserUpdated } from '../emits/User';

export async function createApplication(requesterAccountId: string) {
  const count = await prisma.application.count({
    where: { creatorAccountId: requesterAccountId },
  });

  if (count >= 10) {
    return [
      null,
      generateError('You already created the maximum amount of applications!'),
    ] as const;
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

export async function createBot(
  applicationId: string,
  requesterAccountId: string
) {
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
    return [
      null,
      generateError('This application already has a bot!'),
    ] as const;
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
  })

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
    })
    if (usernameOrTagCheckResults) return [null, usernameOrTagCheckResults] as const;
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

  const updateResult = await updateBotInDatabase(opts);

  emitUserUpdated(opts.userId, {
    username: updateResult.username,
    tag: updateResult.tag,
    ...addToObjectIfExists('avatar', opts.avatar),
    ...addToObjectIfExists('banner', opts.banner),
  });

  return [updateResult, null] as const;
}

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
  });
}