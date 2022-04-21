import {Schema, model, Types} from 'mongoose';
import { generateHexColor } from '../common/random';

export interface Server {
  _id: Types.ObjectId
  name: string,
  createdBy: Types.ObjectId,
  createdAt: number,
  hexColor: string,
  defaultChannel: Types.ObjectId,
}

const schema = new Schema<Server>({
  name: String,
  defaultChannel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  hexColor: {type: String, default: generateHexColor},
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Number, default: Date.now },
});

export const ServerModel = model<Server>('Server', schema);

