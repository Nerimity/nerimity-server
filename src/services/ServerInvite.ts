import { CustomResult } from '../common/CustomResult';
import { CustomError, generateError } from '../common/errorHandler';
import { generateServerInviteCode } from '../common/random';
import { ServerInvite, ServerInviteModel } from '../models/ServerInvite';
import { ServerMemberModel } from '../models/ServerMemberModel';
import { Server, ServerModel } from '../models/ServerModel';
import { joinServer } from './Server';

export const createServerInvite = async (serverId: string, creatorId: string): Promise<CustomResult<ServerInvite, CustomError>> => {

  // check how many invite codes already created by the user
  const count = await ServerInviteModel.countDocuments({ server: serverId, createdBy: creatorId });

  // if user already created max amount of invites, return error
  if (count >= 10) {
    return [null, generateError('You already created the maximum amount of invites!')];
  }


  const serverInvite = await ServerInviteModel.create({
    uses: 0,
    createdBy: creatorId,
    code: generateServerInviteCode(),
    server: serverId,
    isCustom: false,
  });
  const invite =  serverInvite.toObject({versionKey: false});
  return [invite, null];
};

export const joinServerByInviteCode = async (userId: string, inviteCode: string): Promise<CustomResult<Server, CustomError>> => {
  const invite = await ServerInviteModel.findOne({code: inviteCode});
  if (!invite) {
    return [null, generateError('Invalid invite code.')];
  }

  const server = await ServerModel.exists(invite.server);
  if (!server) {
    return [null, generateError('Invalid invite code.')];
  }

  return await joinServer(userId, invite.server.toString()).then(async server => {
    await ServerInviteModel.updateOne({_id: invite._id}, {$inc: {uses: 1}});
    return server;
  });

};

type ServerWithMemberCount = Server & { memberCount: number }; 

export const getServerDetailsByInviteCode = async (inviteCode: string): Promise<CustomResult<ServerWithMemberCount, CustomError>> => {
  const invite = await ServerInviteModel.findOne({code: inviteCode}).populate<{server: Server}>('server').lean();
  if (!invite) {
    return [null, generateError('Invalid invite code.')];
  }

  const memberCount = await ServerMemberModel.estimatedDocumentCount({server: invite.server._id});

  return [{...invite.server, memberCount}, null];
};


export const getServerInvitesByServerId = async (serverId: string, creatorId?: string): Promise<ServerInvite[]> => {

  const invites = await ServerInviteModel.find({
    server: serverId,
    ...(creatorId && {createdBy: creatorId})
  
  })
    .select('-_id -__v -server')
    .populate('createdBy');

  return invites;

};