import { getChannelCache } from '../cache/ChannelCache';
import { getUserIdBySocketId } from '../cache/UserCache';
import {
  addUserToVoice,
  countVoiceUsersInChannel,
  getVoiceUserByUserId,
  isUserInVoice,
  removeVoiceUserByUserId,
} from '../cache/VoiceCache';
import { prisma } from '../common/database';
import { generateError } from '../common/errorHandler';
import { emitServerVoiceUserLeft, emitServerVoiceUserJoined, emitDMVoiceUserLeft, emitDMVoiceUserJoined } from '../emits/Voice';
import { ChannelType, TextChannelTypes } from '../types/Channel';
import { FriendStatus } from '../types/Friend';
import { MessageType } from '../types/Message';
import { createMessage } from './Message';
import { isUserBlocked } from './User/User';

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

  const [channelCache] = await getChannelCache(channelId, userId);

  if (!channelCache) {
    return [
      null,
      generateError(`Channel does not exist.`)
    ]
  }

  if (!TextChannelTypes.includes(channelCache.type)) {
    return [
      null,
      generateError(`Cannot join voice channel.`)
    ]
  }

  if (channelCache.type === ChannelType.DM_TEXT) {
    const isBlocked = await prisma.friend.findFirst({
      where: {
        status: FriendStatus.BLOCKED,
        OR: [
          {userId: userId, recipientId: channelCache.inbox.recipientId},
          {userId: channelCache.inbox.recipientId, recipientId: userId},
        ]
      }
    })

    if (isBlocked) {
      return [null, generateError('Cannot join voice channel.')]
    }
  }

  const count = await countVoiceUsersInChannel(channelId);

  if (count === 0) {
    createMessage({
      type: MessageType.CALL_STARTED,
      channelId,
      userId,
      serverId
    })
  }

  const voice = await addUserToVoice(channelId, userId, {
    socketId,
    serverId,
  });

  if (channelCache.serverId) {
    emitServerVoiceUserJoined(channelId, voice);
  } else {
    emitDMVoiceUserJoined(channelCache, voice);
  }

  return [true, null] as const;
};

export const leaveVoiceChannel = async (userId: string, channelId?: string) => {
  const voiceUser = await getVoiceUserByUserId(userId);
  if (!voiceUser)
    return [null, generateError("You're not in a call.")] as const;

  if (channelId && voiceUser.channelId !== channelId) {
    return [null, generateError("You are not in this channel.")] as const;
  }
  const [channelCache] = await getChannelCache(voiceUser.channelId, userId);

  if (!channelCache) {
    return [
      null,
      generateError(`Channel does not exist.`)
    ]
  }
  await removeVoiceUserByUserId(userId);

  if (channelCache.serverId) {
    emitServerVoiceUserLeft(voiceUser.channelId, userId);
  } else {
    emitDMVoiceUserLeft(channelCache, userId);
  }

  return [true, null] as const;
};
