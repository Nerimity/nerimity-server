import { CustomResult } from '../common/CustomResult';
import { CustomError, generateError } from '../common/errorHandler';
import { emitServerJoin } from '../emits/Server';
import { ChannelModel, ChannelType } from '../models/ChannelModel';
import { ServerMemberModel } from '../models/ServerMemberModel';
import { Server, ServerModel } from '../models/ServerModel';
import { User, UserModel } from '../models/UserModel';

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
    name: 'General',
    server: server._id,
    type: ChannelType.SERVER_TEXT,
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


export const getServers = async (userId: string) => {
  const user = await UserModel.findById(userId).select('servers').populate<{servers: Server[]}>('servers');

  const [ serverChannels, serverMembers ] = await Promise.all([
    ChannelModel.find({server: {$in: user?.servers}}),
    ServerMemberModel.find({server: {$in: user?.servers}}).populate<{User: User}>('user')
  ]);

  return {
    servers: user?.servers || [],
    serverChannels,
    serverMembers,
  };
};

export const joinServer = async (userId: string, serverId: string) => {
  
  const maxServersReached = await hasReachedMaxServers(userId);
  if (maxServersReached) {
    return [null, generateError('You have reached the maximum number of servers.')];
  }

  const server = await ServerModel.findById(serverId);
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if user is already in server
  const isInServer = await ServerMemberModel.exists({user: userId, server: serverId});
  if (isInServer) {
    return [null, generateError('You are already in this server.')];
  }

  await UserModel.updateOne({_id: userId}, {$addToSet: {servers: server._id}});

  const serverMember = await ServerMemberModel.create({
    server: server._id,
    user: userId,
  });

  const [ serverChannels, serverMembers ] = await Promise.all([
    ChannelModel.find({server: server._id}),
    ServerMemberModel.find({server: server._id}).populate<{User: User}>('user')
  ]);




};