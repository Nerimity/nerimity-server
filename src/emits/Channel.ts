import { Channel, Message, User } from '@prisma/client';
import { ChannelCache, InboxCache } from '../cache/ChannelCache';
import { UserCache } from '../cache/UserCache';
import { CHANNEL_TYPING, MESSAGE_CREATED, MESSAGE_DELETED, MESSAGE_REACTION_ADDED, MESSAGE_UPDATED, SERVER_CHANNEL_CREATED, SERVER_CHANNEL_DELETED, SERVER_CHANNEL_UPDATED } from '../common/ClientEventNames';
import { UpdateServerChannelOptions } from '../services/Channel';
import { getIO } from '../socket/socket';



export const emitDMMessageCreated = (channel: ChannelCache, message: Message & {createdBy: Partial<UserCache | User>}, socketId?: string) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipientId as string, channel.inbox?.createdById as string];

  if (socketId) {
    io.in(userIds).except(socketId).emit(MESSAGE_CREATED, {message});
    io.in(socketId).emit(MESSAGE_CREATED, {socketId, message});
    return;
  }

  io.in(userIds).emit(MESSAGE_CREATED, {socketId, message});
};

export const emitDMMessageUpdated = (channel: ChannelCache, messageId: string, updated: Partial<Message>) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipientId as string, channel.inbox?.createdById as string];


  io.in(userIds).emit(MESSAGE_UPDATED, {channelId: channel.id, messageId, updated});
};
export const emitDMMessageReactionAdded = (channel: ChannelCache, reaction: any) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipientId as string, channel.inbox?.createdById as string];


  io.in(userIds).emit(MESSAGE_REACTION_ADDED, reaction);
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

export const emitServerTyping = (channelId: string, typingUserId: string) => {
  const io = getIO();
  io.in(channelId).except(typingUserId).emit(CHANNEL_TYPING, {userId: typingUserId, channelId});
};

export const emitInboxTyping = (channelId: string, inbox: InboxCache, typingUserId: string) => {
  const io = getIO();
  const ids = [inbox.recipientId, inbox.createdById];
  io.in(ids).except(typingUserId).emit(CHANNEL_TYPING, {userId: typingUserId, channelId});
};