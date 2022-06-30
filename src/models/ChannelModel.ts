import {Schema, model, Types} from 'mongoose';

export enum ChannelType {
  DM_TEXT = 0,
  SERVER_TEXT = 1,
  CATEGORY = 2,
}



export interface Channel {
  _id: Types.ObjectId
  name?: string
  server?: Types.ObjectId
  recipient?: Types.ObjectId
  createdBy?: Types.ObjectId
  createdAt: number
  type: ChannelType
  lastMessagedAt?: number
}

const schema = new Schema<Channel>({
  name: String,
  server: { type: Schema.Types.ObjectId, ref: 'Server' },
  recipient: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: Number, required: true },
  lastMessagedAt: { type: Number },
  createdAt: { type: Number, default: Date.now },
});

export const ChannelModel = model<Channel>('Channel', schema);

