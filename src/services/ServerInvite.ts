import { Server, ServerInvite } from '@src/generated/prisma/client';
import { CustomResult } from '../common/CustomResult';
import { prisma, publicUserExcludeFields } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { generateServerInviteCode } from '../common/random';
import { joinServer } from './Server';

export const createServerInvite = async (serverId: string, creatorId: string): Promise<CustomResult<ServerInvite, CustomError>> => {
  // check how many invite codes already created by the user
  const count = await prisma.serverInvite.count({
    where: { serverId, createdById: creatorId },
  });

  // if user already created max amount of invites, return error
  if (count >= env.MAX_INVITES_PER_SERVER) {
    return [null, generateError('You already created the maximum amount of invites!')];
  }

  const newInviteCode = generateServerInviteCode();

  const existingInvite = await prisma.serverInvite.findFirst({
    where: {
      code: newInviteCode,
    },
  });

  if (existingInvite) {
    return [null, generateError('Something went wrong. Please try again!')];
  }

  const serverInvite = await prisma.serverInvite.create({
    data: {
      id: generateId(),
      uses: 0,
      createdById: creatorId,
      code: newInviteCode,
      serverId: serverId,
      isCustom: false,
    },
  });
  return [serverInvite, null];
};

export const deleteServerInvite = async (serverId: string, inviteCode: string, requesterId: string) => {
  const invite = await prisma.serverInvite.findFirst({
    where: {
      serverId,
      OR: [{ createdById: requesterId }, { server: { createdById: requesterId } }],
      code: inviteCode,
    },
  });
  if (!invite) return [null, generateError('Invalid invite code.')] as const;

  await prisma.serverInvite
    .delete({
      where: {
        id: invite.id,
      },
    })
    .catch(() => {});
  return [true, null] as const;
};

export const createServerCustomInvite = async (code: string, serverId: string, creatorId: string): Promise<CustomResult<ServerInvite, CustomError>> => {
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    select: { verified: true },
  });

  if (!server) {
    return [null, generateError('Server not found.')];
  }

  if (!server.verified) {
    return [null, generateError('Server must be verified to create custom invites.')];
  }

  code = code.trim();

  // check if custom invite already exists by someone else
  const strangerInvite = await prisma.serverInvite.findFirst({
    where: {
      code: { mode: 'insensitive', equals: code },
      isCustom: true,
      serverId: { not: serverId },
    },
  });
  if (strangerInvite) {
    return [null, generateError('This code already in use by another server.')];
  }

  // Check if custom invite already exists
  const invite = await prisma.serverInvite.findFirst({
    where: { serverId, isCustom: true },
  });
  if (invite) {
    const newInvite = await prisma.serverInvite.update({
      where: { id: invite.id },
      data: { code },
    });
    return [newInvite, null];
  }

  const serverInvite = await prisma.serverInvite.create({
    data: {
      id: generateId(),
      uses: 0,
      createdById: creatorId,
      code,
      serverId: serverId,
      isCustom: true,
    },
  });
  return [serverInvite, null];
};

export const joinServerByInviteCode = async (userId: string, inviteCode: string): Promise<CustomResult<Server, CustomError>> => {
  const invite = await prisma.serverInvite.findFirst({
    where: { OR: [{ code: { mode: 'insensitive', equals: inviteCode }, isCustom: true }, { code: inviteCode }] },
  });
  if (!invite) {
    return [null, generateError('Invalid invite code.')];
  }

  const server = await prisma.server.findFirst({
    where: { id: invite.serverId },
  });
  if (!server) {
    return [null, generateError('Invalid invite code.')];
  }

  return await joinServer(userId, invite.serverId).then(async (server) => {
    await prisma.serverInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });
    return server;
  });
};

type ServerWithMemberCount = Server & { memberCount: number };

export const getServerDetailsByInviteCode = async (inviteCode: string): Promise<CustomResult<ServerWithMemberCount, CustomError>> => {
  const invite = await prisma.serverInvite.findFirst({
    where: { OR: [{ code: { mode: 'insensitive', equals: inviteCode }, isCustom: true }, { code: inviteCode }] },
    include: { server: true },
  });
  if (!invite) {
    return [null, generateError('Invalid invite code.')];
  }

  const memberCount = await prisma.serverMember.count({
    where: { serverId: invite.serverId },
  });

  return [{ ...invite.server, memberCount }, null];
};

export const getServerInvitesByServerId = async (serverId: string, creatorId?: string): Promise<ServerInvite[]> => {
  const invites = await prisma.serverInvite.findMany({
    where: {
      serverId,
      ...(creatorId && { createdById: creatorId }),
    },
    include: { createdBy: { select: publicUserExcludeFields } },
  });

  return invites;
};
