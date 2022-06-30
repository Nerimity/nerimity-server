import {User} from '../models/UserModel';
import {Channel} from '../models/ChannelModel';
import { InboxModel } from '../models/InboxModel';

export const getInbox = async (userId: string) => {
  return InboxModel.find({user: userId, closed: false}).populate<{channel: Channel & {recipient: User}}>({path: 'channel', populate: {path: 'recipient'}}).lean();
};