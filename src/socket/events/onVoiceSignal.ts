import { Socket } from "socket.io";
import { getVoiceUserByUserId } from "../../cache/VoiceCache";
import { getUserIdBySocketId } from "../../cache/UserCache";
import { getIO } from "../socket";
import { VOICE_SIGNAL_RECEIVED } from "../../common/ClientEventNames";

interface Payload {
  channelId: string;
  signal: any;
  toUserId: string;
}

export async function onVoiceSignal(socket: Socket, payload: Payload) {
  console.log("test")
  const userId = await getUserIdBySocketId(socket.id);
  if (!userId) return;

  // am i in voice channel?
  const voiceUser = await getVoiceUserByUserId(userId)
  if (voiceUser?.socketId !== socket.id) return;

  // is recipient in voice channel?
  const recipientVoiceUser = await getVoiceUserByUserId(payload.toUserId)
  if (!recipientVoiceUser) return;

  // send signal to recipient
  getIO().to(recipientVoiceUser.socketId).emit(VOICE_SIGNAL_RECEIVED, {
    fromUserId: userId,
    channelId: payload.channelId,
    signal: payload.signal
  })


}