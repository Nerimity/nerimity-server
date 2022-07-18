import { CustomResult } from '../common/CustomResult';
import { CustomError, generateError } from '../common/errorHandler';
import { emitServerJoined, emitServerUpdated } from '../emits/Server';
import { ChannelModel, ChannelType } from '../models/ChannelModel';
import { ServerMember, ServerMemberModel } from '../models/ServerMemberModel';
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
    name: opts.name.trim(),
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
  await serverMember.populate<{User: User}>('user');

  const member: Partial<ServerMember> = serverMember.toObject({versionKey: false});
  delete member._id;

  emitServerJoined({
    server: server.toObject({versionKey: false}),
    channels: [channel.toObject({versionKey: false})],
    members: [member],
    joinedMember: member,
  });
  return [server.toObject({versionKey: false}), null];
};


export const getServers = async (userId: string) => {
  const user = await UserModel.findById(userId).select('servers').populate<{servers: Server[]}>('servers');

  const [ serverChannels, serverMembers ] = await Promise.all([
    ChannelModel.find({server: {$in: user?.servers}}),
    ServerMemberModel.find({server: {$in: user?.servers}}).select('-_id').populate<{User: User}>('user')
  ]);

  return {
    servers: user?.servers || [],
    serverChannels,
    serverMembers,
  };
};

export const getServerIds = async (userId: string): Promise<string[]> => {
  const user = await UserModel.findById(userId).select('servers');
  return user?.servers.map(String) || [];
};

export const joinServer = async (userId: string, serverId: string): Promise<CustomResult<Server, CustomError>> => {
  
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

  await serverMember.populate<{user: User}>('user');

  const [ serverChannels, serverMembers ] = await Promise.all([
    ChannelModel.find({server: server._id}),
    ServerMemberModel.find({server: server._id}).select('-_id').populate<{User: User}>('user')
  ]);

  emitServerJoined({
    server: server.toObject({versionKey: false}),
    channels: serverChannels,
    members: serverMembers,
    joinedMember: serverMember.toObject({versionKey: false}),
  });

  return [server.toObject({versionKey: false}), null];
};


export interface UpdateServerOptions {
  name?: string;
  defaultChannel?: string;
}

export const updateServer = async (serverId: string, update: UpdateServerOptions): Promise<CustomResult<UpdateServerOptions, CustomError>> => {
  const server = await ServerModel.findById(serverId);
  if (!server) {
    return [null, generateError('Server does not exist.')];
  }

  // check if channel is a server channel
  if (update.defaultChannel) {
    const channel = await ChannelModel.findById(update.defaultChannel).select('server');
    if (!channel || channel.server?.toString() !== serverId) {
      return [null, generateError('Channel does not exist.')];
    }
  }

  await server.updateOne(update);
  emitServerUpdated(serverId, update);
  return [update, null];

};