import { ChannelCache } from '../cache/ChannelCache';
import { VoiceCacheFormatted } from '../cache/VoiceCache';
import { VOICE_USER_JOINED, VOICE_USER_LEFT } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';

export const emitServerVoiceUserJoined = (
  channelId: string,
  voice: VoiceCacheFormatted
) => {
  const io = getIO();

  io.in(channelId).emit(VOICE_USER_JOINED, voice);
};

export const emitServerVoiceUserLeft = (channelId: string, userId: string) => {
  const io = getIO();

  io.in(channelId).emit(VOICE_USER_LEFT, { userId, channelId });
};



export const emitDMVoiceUserJoined = (
  channel: ChannelCache,
  voice: VoiceCacheFormatted
) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipientId as string, channel.inbox?.createdById as string];

  io.in(userIds).emit(VOICE_USER_JOINED, voice);
};

export const emitDMVoiceUserLeft = (channel: ChannelCache, userId: string) => {
  const io = getIO();

  const userIds = [channel.inbox?.recipientId as string, channel.inbox?.createdById as string];

  io.in(userIds).emit(VOICE_USER_LEFT, { userId, channelId: channel.id });
};
