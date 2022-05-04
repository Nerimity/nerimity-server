import { CustomResult } from '../common/CustomResult';
import { CustomError, generateError } from '../common/errorHandler';
import { generateServerInviteCode } from '../common/random';
import { ServerInvite, ServerInviteModel } from '../models/ServerInvite';

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