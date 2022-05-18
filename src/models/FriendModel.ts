import {Schema, model, Types} from 'mongoose';


export enum FriendStatus {
  SENT = 0,
  PENDING = 1,
  FRIENDS = 2,
}

export interface Friend {
  status: FriendStatus,
  createdAt: number
  user: Types.ObjectId;
  recipient: Types.ObjectId;
}

const schema = new Schema<Friend>({
  status: Number,
  recipient: { type: Schema.Types.ObjectId, ref: 'User' },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Number, default: Date.now },
});

export const FriendModel = model<Friend>('Friend', schema);

