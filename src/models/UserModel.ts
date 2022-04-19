import {Schema, model, Types} from 'mongoose';

export interface User {
  _id: Types.ObjectId
  account: Types.ObjectId
  username: string
  tag: string
  avatar?: string
  bot?: boolean
  createdAt: number
}

const schema = new Schema<User>({
  account: { type: Schema.Types.ObjectId, ref: 'Account' },
  username: String,
  tag: String,
  avatar: String,
  bot: Boolean,
  createdAt: { type: Number, default: Date.now },
});

export const UserModel = model<User>('User', schema);

