import { Server } from '@prisma/client';
import { getUserPresences } from '../cache/UserCache';
import { CustomResult } from '../common/CustomResult';
import { exists, prisma } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS } from '../common/Bitwise';
import { generateHexColor } from '../common/random';
import { emitServerJoined, emitServerLeft, emitServerUpdated } from '../emits/Server';
import { ChannelType } from '../types/Channel';
import { createMessage } from './Message';
import { MessageType } from '../types/Message';

interface CreateServerOptions {
  name: string;
  creatorId: string;
}

export const hasReachedMaxServers = async (userId: string): Promise<boolean> => {
  const serverCount = await prisma.server.count({where: {createdById: userId}});
  return serverCount > 100;
};

export const createServer = async (opts: CreateServerOptions): Promise<CustomResult<Server, CustomError>> => {

  const maxServersReached = await hasReachedMaxServers(opts.creatorId);
  if (maxServersReached) {
    return [null, generateError('You have reached the maximum number of servers.')];
  }

  const serverId = generateId();
  const channelId = generateId();
  const serverMemberId = generateId();
  const roleId = generateId();


  const [server, defaultRole, channel, user, serverMember] = await prisma.$transaction([
    prisma.server.create({
      data: {
        id: serverId,
        name: opts.name.trim(),
        createdById: opts.creatorId,
        defaultChannelId: channelId,
        systemChannelId: channelId,
        defaultRoleId: roleId,
        hexColor: generateHexColor(),
      }
    }),
    prisma.serverRole.create({
      data: {
        id: roleId,
        name: 'All',
        serverId,
        permissions: ROLE_PERMISSIONS.SEND_MESSAGE.bit,
        
        order: 1,
        hexColor: env.DEFAULT_SERVER_ROLE_COLOR,
  
        createdById: opts.creatorId,
      }
    }),
    prisma.channel.create({
      data: {
        id: channelId,
        name: 'General',
        serverId: serverId,
        type: ChannelType.SERVER_TEXT,
        permissions: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
        createdById: opts.creatorId,
      }
    }),
    prisma.user.update({where: {id: opts.creatorId}, data: {servers: {connect: {id: serverId}}} }),
    prisma.serverMember.create({data: {id: serverMemberId, serverId, userId: opts.creatorId}, include: {user: true}}),
  ]);


  emitServerJoined({
    server: server,
    channels: [channel],
    members: [serverMember],
    roles: [defaultRole],
    joinedMember: serverMember,
    memberPresences: []
  });
  return [server, null];
};


export const getServers = async (userId: string) => {

  const user = await prisma.user.findFirst({where: {id: userId}, include: {servers: true}});

  const serverIds = user?.servers.map(server => server.id);

  const [serverChannels, serverMembers, serverRoles] = await prisma.$transaction([
    prisma.channel.findMany({where: {serverId: {in: serverIds}}}),
    prisma.serverMember.findMany({where: {serverId: {in: serverIds}}, include: {user: true}}),
    prisma.serverRole.findMany({where: {serverId: {in: serverIds}}}),
  ]);



  return {
    servers: user?.servers || [],
    serverChannels,
    serverMembers,
    serverRoles
  };
};

export const getServerIds = async (userId: string): Promise<string[]> => {
  const user = await prisma.user.findFirst({where: {id: userId}, select: {servers: {select: {id: true}}}});
  return user?.servers.map(server => server.id) || [];
};

export const joinServer = async (userId: string, serverId: string): Promise<CustomResult<Server, CustomError>> => {
  
  const maxServersReached = await hasReachedMaxServers(userId);
  if (maxServersReached) {
    return [null, generateError('You have reached the maximum number of servers.')];
  }

  
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if user is already in server
  const isInServer = await exists(prisma.serverMember, {where: {serverId, userId}});
  if (isInServer) {
    return [null, generateError('You are already in this server.')];
  }


  if (server.systemChannelId) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.JOIN_SERVER,
      serverId: serverId,
      userId: userId,
    });
  }



  const [ _, serverRoles, serverMember, serverChannels, serverMembers ] = await prisma.$transaction([
    prisma.user.update({where: {id: userId}, data: {servers: {connect: {id: serverId}}} }),
    prisma.serverRole.findMany({where: {serverId}}),
    prisma.serverMember.create({data: {id: generateId(),serverId, userId}, include: {user: true}}),
    prisma.channel.findMany({where: {serverId: server.id}}),
    prisma.serverMember.findMany({where: {serverId: server.id}, include: {user: true}}),
  ]);

  const memberIds = serverMembers.map(sm => sm.user.id);
  const memberPresences = await getUserPresences(memberIds);

  emitServerJoined({
    server: server,
    channels: serverChannels,
    members: serverMembers,
    roles: serverRoles,
    joinedMember: serverMember,
    memberPresences,
  });

  return [server, null];
};


export const deleteOrLeaveServer = async (userId: string, serverId: string): Promise<CustomResult<Server, CustomError>>  => {
  
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const isServerCreator = server.createdById === userId;
  

  // check if user is in the server
  const isInServer = await exists(prisma.serverMember, {where: {serverId, userId}});
  if (!isInServer) {
    return [null, generateError('You are not in this server.')];
  }



  if (isServerCreator) {
    // This one line also deletes related stuff from the database.
    await prisma.server.delete({where: {id: serverId}});
  } else {
    await prisma.$transaction([
      prisma.user.update({where: {id: userId}, data: {servers: {disconnect: {id: serverId}}} }),
      prisma.serverMember.delete({where: {userId_serverId: {serverId: serverId, userId: userId}}}),
      prisma.messageMention.deleteMany({where: { serverId: serverId, mentionedToId: userId}}),
      prisma.serverChannelLastSeen.deleteMany({where: { serverId: serverId, userId: userId}}),
    ]);
  }



  emitServerLeft(userId, serverId, isServerCreator);

  return [server, null];


};


export interface UpdateServerOptions {
  name?: string;
  defaultChannelId?: string;
  systemChannelId?: string | null;
}

export const updateServer = async (serverId: string, update: UpdateServerOptions): Promise<CustomResult<UpdateServerOptions, CustomError>> => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if channel is a server channel
  if (update.defaultChannelId) {
    const channel = await prisma.channel.findFirst({where: {id: update.defaultChannelId}});
    if (!channel || channel.serverId !== serverId) {
      return [null, generateError('Invalid defaultChannelId')];
    }
  }
  if (update.systemChannelId) {
    const channel = await prisma.channel.findFirst({where: {id: update.systemChannelId}});
    if (!channel || channel.serverId !== serverId) {
      return [null, generateError('Invalid systemChannelId')];
    }
  }

  await prisma.server.update({where: {id: serverId}, data: update});
  emitServerUpdated(serverId, update);
  return [update, null];

};
