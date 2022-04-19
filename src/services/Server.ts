import { CustomResult } from '../common/CustomResult';
import { CustomError, generateError } from '../common/errorHandler';
import { emitServerJoin } from '../emits/Server';
import { ChannelModel } from '../models/ChannelModel';
import { ServerMemberModel } from '../models/ServerMemberModel';
import { Server, ServerModel } from '../models/ServerModel';
import { UserModel } from '../models/UserModel';

interface CreateServerOptions {
  name: string;
  creatorId: string;
}

export const hasReachedMaxServers = async (userId: string): Promise<boolean> => {
  const serverCount = await ServerModel.countDocuments({createdBy: userId});
  return serverCount > 100;
};

export const createServer = async (opts: CreateServerOptions): Promise<CustomResult<Server, CustomError>> => {

  const maxServersReached = await hasReachedMaxServers(opts.creatorId);
  if (maxServersReached) {
    return [null, generateError('You have reached the maximum number of servers.')];
  }

  const server = await ServerModel.create({
    name: opts.name,
    createdBy: opts.creatorId,
  });

  const channel = await ChannelModel.create({
    name: 'general',
    server: server._id,
    createdBy: opts.creatorId,
  });

  server.defaultChannel = channel._id;
  await server.save();

  await UserModel.updateOne({_id: opts.creatorId}, {$addToSet: {servers: server._id}});

  const serverMember = await ServerMemberModel.create({
    server: server._id,
    user: opts.creatorId,
  });

  emitServerJoin({
    server: server.toObject({versionKey: false}),
    channels: [channel.toObject({versionKey: false})],
    members: [serverMember.toObject({versionKey: false})],
    joinedMember: serverMember.toObject({versionKey: false}),
  });
  return [server.toObject({versionKey: false}), null];
};