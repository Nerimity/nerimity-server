import {Schema, model, Types} from 'mongoose';

export interface ServerMember {
  _id: Types.ObjectId
  server: Types.ObjectId
  user: Types.ObjectId
  joinedAt: number,
}

const schema = new Schema<ServerMember>({
  server: { type: Schema.Types.ObjectId, ref: 'Server' },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  joinedAt: { type: Number, default: Date.now },
});

export const ServerMemberModel = model<ServerMember>('ServerMember', schema);

