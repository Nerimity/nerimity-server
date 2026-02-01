import { redisClient } from '../common/redis';
import { VOICE_USERS_KEY_HASH, VOICE_USER_CHANNEL_ID_SET } from './CacheKeys';

export interface VoiceCache {
  socketId: string;
  serverId?: string;
}

export interface VoiceCacheFormatted {
  serverId?: string;
  channelId: string;
  userId: string;
}

export async function isUserInVoice(userId: string) {
  return redisClient.exists(VOICE_USER_CHANNEL_ID_SET(userId));
}

export async function getVoiceUserByUserId(
  userId: string
): Promise<(VoiceCache & VoiceCacheFormatted) | null> {
  const channelId = await redisClient.get(VOICE_USER_CHANNEL_ID_SET(userId));
  if (!channelId) return null;

  const stringJson = await redisClient.hGet(
    VOICE_USERS_KEY_HASH(channelId),
    userId
  );
  if (!stringJson) return null;
  const parsedJson = JSON.parse(stringJson);
  return { ...parsedJson, channelId };
}

export async function removeVoiceUserByUserId(userId: string) {
  const channelId = await redisClient.get(VOICE_USER_CHANNEL_ID_SET(userId));
  if (!channelId) return false;

  const multi = redisClient.multi();

  multi.del(VOICE_USER_CHANNEL_ID_SET(userId));
  multi.hDel(VOICE_USERS_KEY_HASH(channelId), userId);

  await multi.exec();
  return true;
}

export async function addUserToVoice(
  channelId: string,
  userId: string,
  data: VoiceCache
): Promise<VoiceCacheFormatted> {
  const multi = redisClient.multi();

  multi.set(VOICE_USER_CHANNEL_ID_SET(userId), channelId);
  multi.hSet(VOICE_USERS_KEY_HASH(channelId), userId, JSON.stringify(data));
  await multi.exec();

  return {
    channelId,
    serverId: data.serverId,
    userId,
  };
}

export async function countVoiceUsersInChannel(channelId: string) {
  return redisClient.hLen(VOICE_USERS_KEY_HASH(channelId));
}

export async function getVoiceUsersByChannelId(
  channelIds: string[]
): Promise<VoiceCacheFormatted[]> {
  if (!channelIds.length) return [];
  const multi = redisClient.multi();
  for (let i = 0; i < channelIds.length; i++) {
    const channelId = channelIds[i]!;
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
