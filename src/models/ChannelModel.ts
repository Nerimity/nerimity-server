import {Schema, model, Types} from 'mongoose';

export interface Channel {
  _id: Types.ObjectId
  name?: string
  server?: Types.ObjectId
  createdBy?: Types.ObjectId
  createdAt: number
}

const schema = new Schema<Channel>({
  name: String,
  server: { type: Schema.Types.ObjectId, ref: 'Server' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Number, default: Date.now },
});

export const ChannelModel = model<Channel>('Channel', schema);

