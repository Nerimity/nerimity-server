import {Schema, model, Types} from 'mongoose';

export interface User {
  _id: Types.ObjectId
  account: Types.ObjectId
  username: string
  tag: string
  avatar?: string
}

const schema = new Schema<User>({
  account: { type: Schema.Types.ObjectId, ref: 'Account' },
  username: String,
  tag: String,
  avatar: String
});

export const UserModel = model<User>('User', schema);

