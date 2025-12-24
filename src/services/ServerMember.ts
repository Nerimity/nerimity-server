import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { emitServerMemberUpdated } from '../emits/Server';
import { arrayDiff, removeDuplicates } from '../common/utils';
import { deleteAllServerMemberCache, getServerMemberCache } from '../cache/ServerMemberCache';
import { ServerRole } from '@src/generated/prisma/client';
import { generateId } from '../common/flakeId';
import { updateSingleMemberPrivateChannelSocketRooms } from './Channel';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, hasBit } from '../common/Bitwise';
import { removeServerMemberPermissionsCache } from '../cache/ChannelCache';
import { addServerAuditLog, AuditLogType } from './AuditLog';
import { addToObjectIfExists } from '@src/common/addToObjectIfExists';

export const getTopRole = async (serverId: string, userId: string): Promise<CustomResult<ServerRole, CustomError>> => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    select: { defaultRoleId: true },
  });
  if (!server) {
    return [null, generateError('Server not found.')];
  }
  const member = await prisma.serverMember.findFirst({
    where: { serverId, userId },
    select: { roleIds: true },
  });
  if (!member) {
    return [null, generateError('Member not found.')];
  }
  member.roleIds.push(server.defaultRoleId);
  const role = await prisma.serverRole.findFirst({
    where: { id: { in: member.roleIds } },
    orderBy: { order: 'desc' },
  });
  return [role!, null];
};

export interface UpdateServerMember {
  roleIds?: string[];
  nickname?: string;
}

export const updateServerMember = async (serverId: string, userId: string, updatedByUserId: string, update: UpdateServerMember): Promise<CustomResult<UpdateServerMember, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  const member = await prisma.serverMember.findFirst({
    where: { serverId, userId: userId },
  });
  if (!member) {
    return [null, generateError('Member is not in this server.')];
  }

  let addedRoles: ServerRole[] = [];
  let removedRoles: ServerRole[] = [];

  if (update.roleIds) {
    const [currentTopRole, error] = await getTopRole(serverId, updatedByUserId);
    if (error) return [null, error];

    update.roleIds = removeDuplicates(update.roleIds);

    if (update.roleIds.includes(server.defaultRoleId)) {
      return [null, generateError('Cannot apply default role.')];
    }

    // check if roles are inside the server.
    const newRoles = await prisma.serverRole.findMany({
      where: {
        id: { in: update.roleIds, not: server.defaultRoleId },
        serverId,
      },
      orderBy: { order: 'desc' },
    });
    if (newRoles.length !== update.roleIds.length) {
      return [null, generateError('One or more roles do not exist or cannot be applied to this member.', 'roleIds')];
    }

    const oldRoles = await prisma.serverRole.findMany({
      where: {
        id: { in: member.roleIds, not: server.defaultRoleId },
        serverId,
      },
      orderBy: { order: 'desc' },
    });

    const topRoleOrder = currentTopRole.order;

    removedRoles = arrayDiff<ServerRole[]>(oldRoles, newRoles, 'order');
    addedRoles = arrayDiff<ServerRole[]>(newRoles, oldRoles, 'order');

    const removedRolePermission = removedRoles.length ? removedRoles[0]!.order >= topRoleOrder : false;
    const addedRolePermission = addedRoles.length ? addedRoles[0]!.order >= topRoleOrder : false;

    // check if updater has higher role order to add the role.
    if (server.createdById !== updatedByUserId && (removedRolePermission || addedRolePermission)) {
      return [null, generateError("One or more roles cannot be applied because you don't have priority.", 'roleIds')];
    }

    if (removedRoles.find((role) => role.botRole)) {
      return [null, generateError('Cannot remove bot role.', 'roleIds')];
    }
    if (addedRoles.find((role) => role.botRole)) {
      return [null, generateError('Cannot add bot role.', 'roleIds')];
    }
  }

  await prisma.serverMember.update({
    where: { userId_serverId: { serverId, userId } },
    data: update,
  });

  const serverChannels = await prisma.channel.findMany({
    where: { serverId },
    select: { id: true, permissions: true },
  });

  await updateSingleMemberPrivateChannelSocketRooms({
    channels: serverChannels,
    serverId,
    userId,
  });

  deleteAllServerMemberCache(serverId);
  if (update.roleIds) {
    await removeServerMemberPermissionsCache(
      serverChannels.map((c) => c.id),
      [userId]
    );
  }

  emitServerMemberUpdated(serverId, userId, update);

  addServerAuditLog({
    actionType: AuditLogType.SERVER_USER_UPDATE,
    actionById: updatedByUserId,
    serverId: serverId,
    data: {
      ...(addedRoles.length ? { addedRoles: addedRoles.map((role) => role.name) } : {}),
      ...(removedRoles.length ? { removedRoles: removedRoles.map((role) => role.name) } : {}),
      ...addToObjectIfExists('nickname', update.nickname),
    },
  });

  return [update, null];
};
interface UpdateServerMemberProfile {
  nickname?: string;
}
export const updateServerMemberProfile = async (serverId: string, userId: string, updatedByUserId: string, update: UpdateServerMemberProfile): Promise<CustomResult<UpdateServerMemberProfile, CustomError>> => {
  const server = await prisma.server.findFirst({ where: { id: serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  const member = await prisma.serverMember.findFirst({
    where: { serverId, userId: userId },
  });
  if (!member) {
    return [null, generateError('Member is not in this server.')];
  }

  if (userId !== updatedByUserId) {
    const [updatedByCache] = await getServerMemberCache(updatedByUserId, serverId);
    const isAdmin = hasBit(updatedByCache?.permissions || 0, ROLE_PERMISSIONS.ADMIN.bit);
    const isCreator = server.createdById === updatedByUserId;
    if (!isAdmin && !isCreator) {
      return [null, generateError('You do not have permission to update this member.')];
    }

    if (userId === server.createdById && !isCreator) {
      return [null, generateError('You cannot update the server creator.')];
    }
  }

  await prisma.serverMember.update({
    where: { userId_serverId: { serverId, userId } },
    data: update,
  });

  deleteAllServerMemberCache(serverId);

  emitServerMemberUpdated(serverId, userId, update);

  addServerAuditLog({
    actionType: AuditLogType.SERVER_USER_UPDATE,
    actionById: updatedByUserId,
    serverId: serverId,
    data: {
      ...addToObjectIfExists('nickname', update.nickname),
    },
  });

  return [update, null];
};

interface AddWelcomeAnswerRolesToUserOpts {
  answerId: string;
  serverId: string;
  userId: string;
}

export const addWelcomeAnswerRolesToUser = async (opts: AddWelcomeAnswerRolesToUserOpts) => {
  const server = await prisma.server.findUnique({ where: { id: opts.serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')] as const;
  }
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { serverId: opts.serverId, userId: opts.userId } },
  });
  if (!member) {
    return [null, generateError('Member is not in this server.')] as const;
  }

  const answer = await prisma.serverWelcomeAnswer.findFirst({ where: { id: opts.answerId, question: { serverId: opts.serverId } }, include: { question: { select: { id: true, multiselect: true, answers: { select: { id: true, roleIds: true } } } } } });

  if (!answer) {
    return [null, generateError('Answer does not exist.')] as const;
  }

  let newRoles = removeDuplicates([...member.roleIds, ...answer.roleIds]);

  if (!answer.question.multiselect) {
    const answers = answer.question.answers;
    for (let i = 0; i < answers.length; i++) {
      const questionAnswer = answers[i]!;
      newRoles = newRoles.filter((roleId) => !questionAnswer.roleIds.includes(roleId));
    }
    newRoles = removeDuplicates([...newRoles, ...answer.roleIds]);
  }
  const transaction = [];
  if (!answer.question.multiselect) {
    transaction.push(
      prisma.answeredServerWelcomeQuestion.deleteMany({
        where: { questionId: answer.question.id, memberId: member.id },
      })
    );
  }

  transaction.push(
    prisma.serverMember.update({
      where: { userId_serverId: { serverId: opts.serverId, userId: opts.userId } },
      data: {
        answeredWelcomeQuestions: {
          create: {
            id: generateId(),
            questionId: answer.question.id,
            answerId: answer.id,
          },
        },
        roleIds: {
          set: newRoles,
        },
      },
    })
  );
  await prisma.$transaction(transaction);

  const serverChannels = await prisma.channel.findMany({
    where: { serverId: opts.serverId },
    select: { id: true, permissions: true },
  });

  await updateSingleMemberPrivateChannelSocketRooms({
    channels: serverChannels,
    serverId: opts.serverId,
    userId: opts.userId,
  });

  deleteAllServerMemberCache(opts.serverId);
  await removeServerMemberPermissionsCache(
    serverChannels.map((c) => c.id),
    [opts.userId]
  );

  emitServerMemberUpdated(opts.serverId, opts.userId, { roleIds: newRoles });
  return [true, null] as const;
};

interface RemoveWelcomeAnswerRolesFromUserOpts {
  answerId: string;
  serverId: string;
  userId: string;
}
export const removeWelcomeAnswerRolesFromUser = async (opts: RemoveWelcomeAnswerRolesFromUserOpts) => {
  const server = await prisma.server.findUnique({ where: { id: opts.serverId } });
  if (!server) {
    return [null, generateError('Server does not exist.')] as const;
  }
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { serverId: opts.serverId, userId: opts.userId } },
  });
  if (!member) {
    return [null, generateError('Member is not in this server.')] as const;
  }

  const answer = await prisma.serverWelcomeAnswer.findFirst({ where: { id: opts.answerId, question: { serverId: opts.serverId } }, include: { question: { select: { id: true, multiselect: true, answers: { select: { id: true, roleIds: true } } } } } });

  if (!answer) {
    return [null, generateError('Answer does not exist.')] as const;
  }

  let newRoles = [...member.roleIds].filter((roleId) => !answer.roleIds.includes(roleId));

  if (!answer.question.multiselect) {
    const answers = answer.question.answers;
    for (let i = 0; i < answers.length; i++) {
      const questionAnswer = answers[i]!;
      if (questionAnswer.id === answer.id) continue;
      newRoles = newRoles.filter((roleId) => !questionAnswer.roleIds.includes(roleId));
    }
  }
  const transaction = [];

  if (!answer.question.multiselect) {
    transaction.push(
      prisma.answeredServerWelcomeQuestion.deleteMany({
        where: { questionId: answer.question.id, memberId: member.id },
      })
    );
  } else {
    transaction.push(
      prisma.answeredServerWelcomeQuestion.delete({
        where: { memberId_answerId: { memberId: member.id, answerId: answer.id } },
      })
    );
  }

  transaction.push(
    prisma.serverMember.update({
      where: { userId_serverId: { serverId: opts.serverId, userId: opts.userId } },
      data: {
        roleIds: {
          set: newRoles,
        },
      },
    })
  );
  await prisma.$transaction(transaction);

  const serverChannels = await prisma.channel.findMany({
    where: { serverId: opts.serverId },
    select: { id: true, permissions: true },
  });

  await updateSingleMemberPrivateChannelSocketRooms({
    channels: serverChannels,
    serverId: opts.serverId,
    userId: opts.userId,
  });

  deleteAllServerMemberCache(opts.serverId);
  await removeServerMemberPermissionsCache(
    serverChannels.map((c) => c.id),
    [opts.userId]
  );

  emitServerMemberUpdated(opts.serverId, opts.userId, { roleIds: newRoles });
  return [true, null] as const;
};
