import { redisClient } from '../common/redis';
import { VOICE_USERS_KEY_HASH, VOICE_USER_CHANNEL_ID_SET } from './CacheKeys';

export interface VoiceCache {
  socketId: string;
  serverId?: string;
}

export async function isUserInVoice(userId: string) {
  return redisClient.exists(VOICE_USER_CHANNEL_ID_SET(userId));
}

export async function addUserToVoice(
  channelId: string,
  userId: string,
  data: VoiceCache
) {
  redisClient.set(VOICE_USER_CHANNEL_ID_SET(userId), channelId);
  redisClient.hSet(
    VOICE_USERS_KEY_HASH(channelId),
    userId,
    JSON.stringify(data)
  );
}

export async function getVoiceUsersByChannelId(channelIds: string[]) {
  if (!channelIds.length) return [];
  const multi = redisClient.multi();
  for (let i = 0; i < channelIds.length; i++) {
    const channelId = channelIds[i];
    multi.hGetAll(VOICE_USERS_KEY_HASH(channelId));
  }
  const array = await multi.exec();

  return channelIds
    .map((channelId, i) => {
      const obj = Object.assign({}, array[i]);

      return Object.keys(obj).map((key) => ({
        userId: key,
        channelId,
        ...JSON.parse((obj as any)[key]),
        socketId: undefined,
      }));
    })
    .flat();
}
