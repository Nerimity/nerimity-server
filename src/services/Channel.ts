import { Channel } from '@prisma/client';
import { getChannelCache, updateServerChannelCache } from '../cache/ChannelCache';
import { getServerMemberCache, getServerMembersCache } from '../cache/ServerMemberCache';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { CustomResult } from '../common/CustomResult';
import { dateToDateTime, prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { CHANNEL_PERMISSIONS, hasBit } from '../common/Bitwise';
import { emitServerChannelCreated, emitServerChannelDeleted, emitServerChannelUpdated } from '../emits/Channel';
import { emitNotificationDismissed } from '../emits/User';
import {  ChannelType } from '../types/Channel';
import { getIO } from '../socket/socket';
import env from '../common/env';

export const dismissChannelNotification = async (userId: string, channelId: string, emit = true) => {
  const [channel] = await getChannelCache(channelId, userId);
  if (!channel) return;


  const transactions: any[] = [
    prisma.messageMention.deleteMany({where: { mentionedToId: userId, channelId: channelId }})
  ];


  if (channel.server) {
    const [serverMember] = await getServerMemberCache(channel.server.id, userId);
    if (!serverMember) return;
    const serverId = channel.server.id;

    transactions.push(prisma.serverChannelLastSeen.upsert({
      where: {
        channelId_userId_serverId: {
          userId,
          serverId,
          channelId 
        }
      },
      create: {
        id: generateId(),
        userId,
        serverId,
        channelId,
        lastSeen: dateToDateTime(),
      },
      update: {
        lastSeen: dateToDateTime(),
      }
    }));
  }

  await prisma.$transaction(transactions);

  emit && emitNotificationDismissed(userId, channelId);
};



export const getAllMessageMentions = async (userId: string) => {
  const mentions = await prisma.messageMention.findMany({
    where: {
      mentionedToId: userId,
    },
    select: {
      mentionedById: true,
      mentionedBy: true,
      createdAt: true,
      channelId: true,
      serverId: true,
      count: true
    }
  });
  return mentions;
};

export const getLastSeenServerChannelIdsByUserId = async (userId: string) => {
  const results = await prisma.serverChannelLastSeen.findMany({
    where: {userId},
    select: {
      channelId: true,
      lastSeen: true
    }
  });

  const lastSeenChannels: Record<string, Date> = {};

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    lastSeenChannels[result.channelId] = result.lastSeen;
  }
  return lastSeenChannels;
};


export const createServerChannel = async (serverId: string, channelName: string, userId: string): Promise<CustomResult<Channel, CustomError>> => {

  const channelCount = await prisma.channel.count({ where: {serverId: serverId}});
  if (channelCount >= env.MAX_CHANNELS_PER_SERVER) {
    return [null, generateError('You already created the maximum amount of channels for this server.')];
  }

  const channel = await prisma.channel.create({
    data: {
      id: generateId(),
      name: channelName,
      serverId: serverId,
      type: ChannelType.SERVER_TEXT,
      permissions: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
      createdById: userId,
    }
  });


  getIO().in(serverId).socketsJoin(channel.id);


  emitServerChannelCreated(serverId, channel);

  return [channel, null];
};


export interface UpdateServerChannelOptions {
  name?: string;
  permissions?: number;
}

export const updateServerChannel = async (serverId: string, channelId: string, update: UpdateServerChannelOptions): Promise<CustomResult<UpdateServerChannelOptions, CustomError>> => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  const channel = await prisma.channel.findFirst({where: {id: channelId, serverId: serverId}});
  if (!channel) {
    return [null, generateError('Channel does not exist.')];
  }

  await prisma.channel.update({where: {id: channel.id}, data: update});
  await updateServerChannelCache(channelId, {
    ...addToObjectIfExists('name', update.name),
    ...addToObjectIfExists('permissions', update.permissions),
  });
  emitServerChannelUpdated(serverId, channelId, update);



  if (update.permissions !== undefined) {
    const wasPrivate = hasBit(channel.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    const isPrivate = hasBit(update.permissions || 0, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
    if (wasPrivate !== isPrivate) {
      getIO().in(serverId).socketsLeave(channelId);
      const serverMembers = await getServerMembersCache(serverId);
      
      for (let i = 0; i < serverMembers.length; i++) {
        const member = serverMembers[i];
        const isAdmin = server.createdById === member.userId;
        if (isPrivate && !isAdmin) continue;
        getIO().in(member.userId).socketsJoin(channelId);
      }
    }
  }



  return [update, null];

};

export const deleteServerChannel = async (serverId: string, channelId: string): Promise<CustomResult<string, CustomError>> => {
  const server = await prisma.server.findFirst({where: {id: serverId}});
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if channel is default channel
  if (server.defaultChannelId === channelId) {
    return [null, generateError('You cannot delete the default channel.')];
  }

  // Delete the channel
  const channel = await prisma.channel.findFirst({where: {id: channelId, serverId: serverId}});
  if (!channel) {
    return [null, generateError('Channel does not exist.')];
  }



  await prisma.channel.delete({where: {id: channelId}});


  getIO().in(serverId).socketsLeave(channelId);


  emitServerChannelDeleted(serverId, channelId);

  return [channelId, null];

};