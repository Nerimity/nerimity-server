import {Schema, model, Types} from 'mongoose';

export interface ServerChannelLastSeen {
  _id: Types.ObjectId
  user: Types.ObjectId
  server: Types.ObjectId
  channel: Types.ObjectId
  lastSeen: number,
}

const schema = new Schema<ServerChannelLastSeen>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  server: { type: Schema.Types.ObjectId, ref: 'Server' },
  channel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  lastSeen: { type: Number },
});

export const ServerChannelLastSeenModel = model<ServerChannelLastSeen>('ServerChannelLastSeen', schema);

