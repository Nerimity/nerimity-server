import { UserCache } from '../cache/UserCache';
import { MESSAGE_CREATED, MESSAGE_DELETED } from '../common/ClientEventNames';
import { Message } from '../models/MessageModel';
import { getIO } from '../socket/socket';



export const emitDMMessageCreated = (recipientIds: string[], message: Omit<Message, 'createdBy'> &  {createdBy: UserCache}, excludeSocketId?: string) => {
  const io = getIO();

  if (excludeSocketId) {
    io.in(recipientIds).except(excludeSocketId).emit(MESSAGE_CREATED, message);
    return;
  }

  io.in(recipientIds).emit(MESSAGE_CREATED, message);
};

export const emitDMMessageDeleted = (recipientIds: string[], data: {channelId: string, messageId: string}) => {
  const io = getIO();

  io.in(recipientIds).emit(MESSAGE_DELETED, data);
};