import { Server, ServerInvite } from '@prisma/client';
import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { generateServerInviteCode } from '../common/random';
import { joinServer } from './Server';

export const createServerInvite = async (serverId: string, creatorId: string): Promise<CustomResult<ServerInvite, CustomError>> => {

  // check how many invite codes already created by the user
  const count = await prisma.serverInvite.count({where: {serverId, createdById: creatorId}});

  // if user already created max amount of invites, return error
  if (count >= env.MAX_INVITES_PER_SERVER) {
    return [null, generateError('You already created the maximum amount of invites!')];
  }


  const serverInvite = await prisma.serverInvite.create({
    data: {
      id: generateId(),
      uses: 0,
      createdById: creatorId,
      code: generateServerInviteCode(),
      serverId: serverId,
      isCustom: false,
    }
  });
  return [serverInvite, null];
};

export const joinServerByInviteCode = async (userId: string, inviteCode: string): Promise<CustomResult<Server, CustomError>> => {
  const invite = await prisma.serverInvite.findFirst({where: {code: inviteCode}});
  if (!invite) {
    return [null, generateError('Invalid invite code.')];
  }

  const server = await prisma.server.findFirst({where: {id: invite.serverId}});
  if (!server) {
    return [null, generateError('Invalid invite code.')];
  }

  return await joinServer(userId, invite.serverId).then(async server => {
    await prisma.serverInvite.update({where: {id: invite.id}, data: {uses: {increment: 1}}});
    return server;
  });

};

type ServerWithMemberCount = Server & { memberCount: number }; 

export const getServerDetailsByInviteCode = async (inviteCode: string): Promise<CustomResult<ServerWithMemberCount, CustomError>> => {
  const invite = await prisma.serverInvite.findFirst({where: {code: inviteCode}, include: {server: true}});
  if (!invite) {
    return [null, generateError('Invalid invite code.')];
  }

  const memberCount = await prisma.serverMember.count({where: {serverId: invite.serverId}});

  return [{...invite.server, memberCount}, null];
};


export const getServerInvitesByServerId = async (serverId: string, creatorId?: string): Promise<ServerInvite[]> => {

  const invites = await prisma.serverInvite.findMany({
    where: {
      serverId,
      ...(creatorId && {createdById: creatorId})
    },
    include: { createdBy: true }
  });

  return invites;

};