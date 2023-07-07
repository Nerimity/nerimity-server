import { getUserIdBySocketId } from '../cache/UserCache';
import { isUserInVoice } from '../cache/VoiceCache';
import { generateError } from '../common/errorHandler';

export const joinVoiceChannel = async (
  userId: string,
  socketId: string,
  channelId: string
) => {
  const socketUserId = await getUserIdBySocketId(socketId);

  if (socketUserId !== userId) {
    return [
      null,
      generateError('Invalid socketId or not connected to WebSocket.'),
    ] as const;
  }

  const isAlreadyInVoice = await isUserInVoice(channelId, userId);
  if (isAlreadyInVoice) {
    return [null, generateError('You are already in a call.')] as const;
  }

  return [true, null] as const;
};
