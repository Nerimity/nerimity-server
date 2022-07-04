import {User} from '../models/UserModel';
import {Channel} from '../models/ChannelModel';
import { InboxModel } from '../models/InboxModel';

export const getInbox = async (userId: string) => {
  return InboxModel.find({createdBy: userId, closed: false})
    .populate<{channel: Channel}>('channel', '-createdBy')
    .populate<{recipient: User}>('recipient')
    .lean();
};