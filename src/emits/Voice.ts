import { VoiceCacheFormatted } from '../cache/VoiceCache';
import { VOICE_USER_JOINED, VOICE_USER_LEFT } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';

export const emitVoiceUserJoined = (
  channelId: string,
  voice: VoiceCacheFormatted
) => {
  const io = getIO();

  io.in(channelId).emit(VOICE_USER_JOINED, voice);
};

export const emitVoiceUserLeft = (userId: string, channelId: string) => {
  const io = getIO();

  io.in(channelId).emit(VOICE_USER_LEFT, { userId, channelId });
};
