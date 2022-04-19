import {Schema, model, Types} from 'mongoose';

export interface User {
  _id: Types.ObjectId
  account: Types.ObjectId
  username: string
  tag: string
  avatar?: string
  servers: Types.ObjectId[]
  bot?: boolean
  createdAt: number
}

const schema = new Schema<User>({
  account: { type: Schema.Types.ObjectId, ref: 'Account', select: false },
  username: String,
  tag: String,
  avatar: String,
  servers: [{ type: Schema.Types.ObjectId, ref: 'Server', select: false}],
  bot: Boolean,
  createdAt: { type: Number, default: Date.now },
});

export const UserModel = model<User>('User', schema);

