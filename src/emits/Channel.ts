import { ChannelCache } from '../cache/ChannelCache';
import { UserCache } from '../cache/UserCache';
import { MESSAGE_CREATED, MESSAGE_DELETED } from '../common/ClientEventNames';
import { Message } from '../models/MessageModel';
import { getIO } from '../socket/socket';



export const emitDMMessageCreated = (channel: ChannelCache, message: Omit<Message, 'createdBy'> &  {createdBy: UserCache}, excludeSocketId?: string) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipient as string, channel.inbox?.createdBy as unknown as string];
  if (excludeSocketId) {
    io.in(userIds).except(excludeSocketId).emit(MESSAGE_CREATED, message);
    return;
  }

  io.in(userIds).emit(MESSAGE_CREATED, message);
};

export const emitDMMessageDeleted = (channel: ChannelCache, data: {channelId: string, messageId: string}) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipient as string, channel.inbox?.createdBy as unknown as string];

  io.in(userIds).emit(MESSAGE_DELETED, data);
};