import {Schema, model, Types} from 'mongoose';
import { generateHexColor } from '../common/random';

export interface User {
  _id: Types.ObjectId
  account: Types.ObjectId
  username: string
  tag: string
  avatar?: string
  hexColor: string
  servers: Types.ObjectId[]
  bot?: boolean
  joinedAt: number
}

const schema = new Schema<User>({
  account: { type: Schema.Types.ObjectId, ref: 'Account', select: false },
  username: String,
  tag: String,
  avatar: String,
  hexColor: {type: String, default: generateHexColor},
  servers: [{ type: Schema.Types.ObjectId, ref: 'Server', select: false}],
  bot: Boolean,
  joinedAt: { type: Number, default: Date.now },
});

export const UserModel = model<User>('User', schema);

