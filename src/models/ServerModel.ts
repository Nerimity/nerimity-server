import {Schema, model, Types} from 'mongoose';

export interface Server {
  _id: Types.ObjectId
  name: string,
  createdBy: Types.ObjectId,
  createdAt: number,
  defaultChannel: Types.ObjectId,
}

const schema = new Schema<Server>({
  name: String,
  defaultChannel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Number, default: Date.now },
});

export const ServerModel = model<Server>('Server', schema);

