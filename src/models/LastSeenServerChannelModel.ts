import {Schema, model, Types} from 'mongoose';

export interface LastSeenServerChannel {
  _id: Types.ObjectId
  user: Types.ObjectId
  server: Types.ObjectId
  channel: Types.ObjectId
  lastSeen: number,
}

const schema = new Schema<LastSeenServerChannel>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  server: { type: Schema.Types.ObjectId, ref: 'Server' },
  channel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  lastSeen: { type: Number },
});

export const LastSeenServerChannelModel = model<LastSeenServerChannel>('LastSeenServerChannel', schema);

