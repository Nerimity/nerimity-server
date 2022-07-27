import { getChannelCache } from '../cache/ChannelCache';
import { getServerMemberCache } from '../cache/ServerMemberCache';
import { CustomResult } from '../common/CustomResult';
import { CustomError, generateError } from '../common/errorHandler';
import { emitServerChannelCreated } from '../emits/Channel';
import { emitNotificationDismissed } from '../emits/User';
import { Channel, ChannelModel, ChannelType } from '../models/ChannelModel';
import { MessageMentionModel } from '../models/MessageMentionModel';
import { ServerChannelLastSeenModel } from '../models/ServerChannelLastSeenModel';

export const dismissChannelNotification = async (userId: string, channelId: string, emit = true) => {
  const [channel] = await getChannelCache(channelId, userId);
  if (!channel) return;

  if (channel.server) {
    const [serverMember] = await getServerMemberCache(channel.server._id, userId);
    if (!serverMember) return;
    const serverId = channel.server._id;

    await ServerChannelLastSeenModel.updateOne({ user: userId, server: serverId, channel: channelId }, {
      $set: {
        user: userId,
        server: serverId,
        channel: channelId,
        lastSeen: Date.now(),
      }
    }, {upsert: true});
    emit && emitNotificationDismissed(userId, channelId);

    return;
  }

  await MessageMentionModel.deleteOne({ mentionedTo: userId, channel: channelId });

  emit && emitNotificationDismissed(userId, channelId);

};



export const getAllMessageMentions = async (userId: string) => {
  const mentions = await MessageMentionModel.find({ mentionedTo: userId }).select('mentionedBy createdAt channel server count -_id').lean();
  return mentions;
};

export const getLastSeenServerChannelIdsByUserId = async (userId: string) => {
  const results = await ServerChannelLastSeenModel.find({ user: userId }).select('channel lastSeen').lean();

  const lastSeenChannels: Record<string, number> = {};

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    lastSeenChannels[result.channel.toString()] = result.lastSeen;
  }
  return lastSeenChannels;
};


export const createServerChannel = async (serverId: string, channelName: string, userId: string): Promise<CustomResult<Channel, CustomError>> => {

  const channelCount = await ChannelModel.countDocuments({ server: serverId });
  if (channelCount >= 100) {
    return [null, generateError('You already created the maximum amount of channels for this server.')];
  }

  const channel = await ChannelModel.create({
    name: channelName,
    server: serverId,
    type: ChannelType.SERVER_TEXT,
    createdBy: userId,
  });

  const channelObj = channel.toObject({versionKey: false});

  emitServerChannelCreated(serverId, channelObj);

  return [channelObj, null];
};