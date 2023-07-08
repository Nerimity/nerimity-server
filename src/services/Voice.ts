import { getUserIdBySocketId } from '../cache/UserCache';
import { addUserToVoice, isUserInVoice } from '../cache/VoiceCache';
import { generateError } from '../common/errorHandler';

export const joinVoiceChannel = async (
  userId: string,
  socketId: string,
  channelId: string,
  serverId?: string
) => {
  const socketUserId = await getUserIdBySocketId(socketId);

  if (socketUserId !== userId) {
    return [
      null,
      generateError('Invalid socketId or not connected to WebSocket.'),
    ] as const;
  }

  const isAlreadyInVoice = await isUserInVoice(userId);
  if (isAlreadyInVoice) {
    return [null, generateError('You are already in a call.')] as const;
  }

  addUserToVoice(channelId, userId, {
    socketId,
    serverId,
  });
  return [true, null] as const;
};
