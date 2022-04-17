import {Schema, model, Types} from 'mongoose';

interface Account {
  _id: Types.ObjectId
  user: Types.ObjectId
  email: string
  password: string
  passwordVersion: number
  ipAddress: string
}

const schema = new Schema<Account>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  email: {type: String, unique: true},
  password: String,
  passwordVersion: Number,
  ipAddress: String
});

export const AccountModel = model<Account>('Account', schema);

