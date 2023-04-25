import { Server } from '@prisma/client';
import { getUserPresences } from '../cache/UserCache';
import { CustomResult } from '../common/CustomResult';
import { exists, prisma, removeServerIdFromAccountOrder } from '../common/database';
import env from '../common/env';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS } from '../common/Bitwise';
import { generateHexColor } from '../common/random';
import { emitServerChannelOrderUpdated, emitServerJoined, emitServerLeft, emitServerOrderUpdated, emitServerUpdated } from '../emits/Server';
import { ChannelType } from '../types/Channel';
import { createMessage, deleteRecentMessages } from './Message';
import { MessageType } from '../types/Message';
import { emitUserPresenceUpdateTo } from '../emits/User';
import * as nerimityCDN from '../common/nerimityCDN'; 

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
        order: 1,
      },
      include: {_count: {select: {attachments: true}}}
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
    prisma.channel.findMany({where: {serverId: {in: serverIds}}, include: {_count: {select: {attachments: true}}}}),
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


  const isBanned = await exists(prisma.bannedServerMember, {where: {serverId, userId}});

  if (isBanned) {
    return [null, generateError('You are banned from this server')];
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
    prisma.channel.findMany({where: {serverId: server.id}, include: {_count: {select: {attachments: true}}}}),
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


  const [userPresence] = await getUserPresences([userId]);
  userPresence && emitUserPresenceUpdateTo(serverId, userPresence);


  return [server, null];
};

export const deleteOrLeaveServer = async (userId: string, serverId: string, ban = false, leaveMessage = true): Promise<CustomResult<boolean, CustomError>>  => {
  
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const isServerCreator = server.createdById === userId;
  

  // check if user is in the server
  const isInServer = await exists(prisma.serverMember, {where: {serverId, userId}});
  if (!isInServer && !ban) {
    return [null, generateError('You are not in this server.')];
  }

  if (!isInServer && ban) {
    const isBanned = await prisma.bannedServerMember.findFirst({where: { serverId, userId }});
    if (isBanned) {
      return [null, generateError('User already banned.')];
    }
    await prisma.bannedServerMember.create({
      data: {
        id: generateId(),
        userId,
        serverId,
      }
    });
    return [true, null];
  }



  if (isServerCreator) {
    // This one line also deletes related stuff from the database.
    await prisma.server.delete({where: {id: serverId}});
  } else {
    const transactions: any[] = [
      prisma.user.update({where: {id: userId}, data: {servers: {disconnect: {id: serverId}}} }),
      prisma.serverMember.delete({where: {userId_serverId: {serverId: serverId, userId: userId}}}),
      prisma.messageMention.deleteMany({where: { serverId: serverId, mentionedToId: userId}}),
      prisma.serverChannelLastSeen.deleteMany({where: { serverId: serverId, userId: userId}}),
    ];
    if (ban) {
      transactions.push(prisma.bannedServerMember.create({
        data: {
          id: generateId(),
          userId,
          serverId,
        }
      }));
    }
    await prisma.$transaction(transactions);

    if (server.systemChannelId && leaveMessage) {
      await createMessage({
        channelId: server.systemChannelId,
        type: MessageType.LEAVE_SERVER,
        userId,
        serverId,
        updateLastSeen: false

      });
    }
  }
  await removeServerIdFromAccountOrder(userId, serverId);
  emitServerLeft(userId, serverId, isServerCreator);

  return [false, null];

};


export const kickServerMember = async (userId: string, serverId: string) => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  if (server.createdById === userId) {
    return [null, generateError('You can not kick yourself.')];
  }

  const [,error] = await deleteOrLeaveServer(userId, serverId, false, true);
  if (error) return [null, error];

  if (server.systemChannelId) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.KICK_USER,
      userId,
      serverId,
      updateLastSeen: false
    });
  }
  return [true, null];
};

export const serverMemberBans = async (serverId: string) => {
  return prisma.bannedServerMember.findMany({ where: { serverId }, select: { serverId: true, user: true }});
};
export const serverMemberRemoveBan = async (serverId: string, userId: string): Promise<CustomResult<boolean, CustomError>> => {
  const bannedMember = await prisma.bannedServerMember.findFirst({where: {serverId, userId}});
  if (!bannedMember) {
    return [null, generateError('This member is not banned.')];
  }
  await prisma.bannedServerMember.delete({ where: { id: bannedMember.id }});
  return [true, null];
};

export const banServerMember = async (userId: string, serverId: string, shouldDeleteRecentMessages?: boolean) => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }
  if (server.createdById === userId) {
    return [null, generateError('You can not kick yourself.')];
  }

  const [,error] = await deleteOrLeaveServer(userId, serverId, true, false);
  if (error) return [null, error];

  if (shouldDeleteRecentMessages) {
    await deleteRecentMessages(userId, serverId);
  }

  if (server.systemChannelId) {
    await createMessage({
      channelId: server.systemChannelId,
      type: MessageType.BAN_USER,
      userId,
      serverId,
      updateLastSeen: false
    });
  }
  return [true, null];
};


export interface UpdateServerOptions {
  name?: string;
  defaultChannelId?: string;
  systemChannelId?: string | null;
  avatar?: string;
  banner?: string;
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


  if (update.avatar) {
    const [data, error] = await nerimityCDN.uploadAvatar(update.avatar, serverId);
    if (error) return [null, generateError(error)];
    if (data) {
      update.avatar = data.path;
    }
  }

  if (update.banner) {
    const [data, error] = await nerimityCDN.uploadBanner(update.banner, serverId);
    if (error) return [null, generateError(error)];
    if (data) {
      update.banner = data.path;
    }
  }



  await prisma.server.update({where: {id: serverId}, data: update});
  emitServerUpdated(serverId, update);
  return [update, null];

};



export const updateServerOrder = async (userId: string, orderedServerIds: string[]) => {
  const user = await prisma.user.findFirst({where: {id: userId}, select: {servers: {select: {id: true}}}});
  
  if (!user) {
    return [null, generateError('User does not exist.')];
  }

  const joinedServerIds = user.servers.map((server) => server.id);
  if (joinedServerIds.length !== orderedServerIds.length) {
    return [null, generateError('Server order length does not match.')];
  }

  const doesNotExist = joinedServerIds.find(id => !orderedServerIds.includes(id)); 

  if (doesNotExist) {
    return [null, generateError('Invalid server ids.')];
  }

  await prisma.account.update({
    where: {userId},
    data: {
      serverOrderIds: orderedServerIds
    }
  });

  emitServerOrderUpdated(userId, orderedServerIds);

  return [{success: true}, null];
};



interface UpdateServerChannelOrderOpts {
  serverId: string;
  updated: {id: string, order: number}[]
}



export async function updateServerChannelOrder(opts: UpdateServerChannelOrderOpts) {
  const serverChannels = await prisma.channel.findMany({
    where: {serverId: opts.serverId},
    orderBy: [{order: 'asc'}, {createdAt: 'asc'}]
  });

  const existingIds: string[] = [];
  
  for (let i = 0; i < serverChannels.length; i++) {
    const channel = serverChannels[i];
    channel.order = i + 1;
    existingIds.push(channel.id);
  }

  const safeUpdatedChannels = opts.updated.filter(updated => existingIds.includes(updated.id));

  await prisma.$transaction(
    safeUpdatedChannels
      .map(updated => prisma.channel.update({
        where: {id: updated.id},
        data: {order: updated.order}
      }))
  );

  emitServerChannelOrderUpdated(opts.serverId, safeUpdatedChannels);
  return [{updated: safeUpdatedChannels}, null] as const;
}

