import { Channel, Message, User } from '@prisma/client';
import { ChannelCache } from '../cache/ChannelCache';
import { UserCache } from '../cache/UserCache';
import { MESSAGE_CREATED, MESSAGE_DELETED, SERVER_CHANNEL_CREATED, SERVER_CHANNEL_DELETED, SERVER_CHANNEL_UPDATED } from '../common/ClientEventNames';
import { UpdateServerChannelOptions } from '../services/Channel';
import { getIO } from '../socket/socket';



export const emitDMMessageCreated = (channel: ChannelCache, message: Message & {createdBy: Partial<UserCache | User>}, excludeSocketId?: string) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipientId as string, channel.inbox?.createdById as string];

  if (excludeSocketId) {
    io.in(userIds).except(excludeSocketId).emit(MESSAGE_CREATED, message);
    return;
  }

  io.in(userIds).emit(MESSAGE_CREATED, message);
};

export const emitDMMessageDeleted = (channel: ChannelCache, data: {channelId: string, messageId: string}) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipientId as string, channel.inbox?.createdById as unknown as string];

  io.in(userIds).emit(MESSAGE_DELETED, data);
};


export const emitServerChannelCreated = (serverId: string, channel: Channel) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_CHANNEL_CREATED, {serverId, channel});

};

export const emitServerChannelUpdated = (serverId: string, channelId: string, updated: UpdateServerChannelOptions) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_CHANNEL_UPDATED, {serverId, channelId, updated});
};
export const emitServerChannelDeleted = (serverId: string, channelId: string) => {
  const io = getIO();

  io.in(serverId).emit(SERVER_CHANNEL_DELETED, {serverId, channelId});
};