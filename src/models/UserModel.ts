import {Schema, model, Types} from 'mongoose';
import { generateHexColor } from '../common/random';


export enum UserStatus {
  OFFLINE = 0,
  ONLINE = 1,
  LTP = 2, // Looking To Play
  AFK = 3, // Away from keyboard
  DND = 4, // Do not disturb
}
export interface User {
  _id: Types.ObjectId
  account: Types.ObjectId
  username: string
  tag: string
  avatar?: string
  status: UserStatus
  hexColor: string
  servers: Types.ObjectId[]
  friends: Types.ObjectId[]
  bot?: boolean
  joinedAt: number
}

const schema = new Schema<User>({
  account: { type: Schema.Types.ObjectId, ref: 'Account', select: false },
  username: String,
  tag: String,
  avatar: String,
  status: { type: Number, default: UserStatus.ONLINE, select: false },
  hexColor: {type: String, default: generateHexColor},
  servers: [{ type: Schema.Types.ObjectId, ref: 'Server', select: false}],
  friends: [{ type: Schema.Types.ObjectId, ref: 'Friend', select: false}],
  bot: Boolean,
  joinedAt: { type: Number, default: Date.now },
});

export const UserModel = model<User>('User', schema);

