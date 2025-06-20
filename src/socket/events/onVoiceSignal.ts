import { Socket } from 'socket.io';
import { getVoiceUserByUserId } from '../../cache/VoiceCache';
import { getUserIdBySocketId } from '../../cache/UserCache';
import { getIO } from '../socket';
import { VOICE_SIGNAL_RECEIVED } from '../../common/ClientEventNames';
import env from '../../common/env';
import { createQueue } from '@nerimity/mimiqueue';
import { redisClient } from '../../common/redis';

interface Payload {
  channelId: string;
  signal: any;
  toUserId: string;
}

export const queue = createQueue({
  name: 'voiceSignal',
  prefix: env.TYPE,
  redisClient: redisClient,
});

export async function onVoiceSignal(socket: Socket, payload: Payload) {
  await queue.add(
    async () => {
      await handleVoiceSignal(socket, payload).catch((err) => {
        console.error(err);
      });
    },
    { groupName: payload.channelId }
  );
}

const handleVoiceSignal = async (socket: Socket, payload: Payload) => {
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;

  // am i in voice channel?
  const voiceUser = await getVoiceUserByUserId(userId);
  if (voiceUser?.socketId !== socket.id) return;

  // is recipient in voice channel?
  const recipientVoiceUser = await getVoiceUserByUserId(payload.toUserId);
  if (!recipientVoiceUser) return;

  // are we in the same voice channel?
  if (voiceUser.channelId !== recipientVoiceUser.channelId) {
    return;
  }

  // send signal to recipient
  getIO().to(recipientVoiceUser.socketId).emit(VOICE_SIGNAL_RECEIVED, {
    fromUserId: userId,
    channelId: payload.channelId,
    signal: payload.signal,
  });
};
