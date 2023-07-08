import { getUserIdBySocketId } from '../cache/UserCache';
import {
  addUserToVoice,
  getVoiceUserByUserId,
  isUserInVoice,
  removeVoiceUserByUserId,
} from '../cache/VoiceCache';
import { generateError } from '../common/errorHandler';
import { emitVoiceUserJoined, emitVoiceUserLeft } from '../emits/Voice';

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
    await leaveVoiceChannel(userId);
  }

  const voice = await addUserToVoice(channelId, userId, {
    socketId,
    serverId,
  });

  emitVoiceUserJoined(channelId, voice);

  return [true, null] as const;
};

export const leaveVoiceChannel = async (userId: string) => {
  const voiceUser = await getVoiceUserByUserId(userId);
  if (!voiceUser)
    return [null, generateError("You're not in a call.")] as const;
  await removeVoiceUserByUserId(userId);
  emitVoiceUserLeft(userId, voiceUser.channelId);
  return [true, null] as const;
};
