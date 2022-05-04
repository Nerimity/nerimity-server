import {Schema, model, Types} from 'mongoose';

export interface ServerInvite {
  _id: Types.ObjectId,
  code: string,
  isCustom: boolean,
  uses: number,
  server: Types.ObjectId,
  createdBy: Types.ObjectId,
  createdAt: number,

}

const schema = new Schema<ServerInvite>({
  code: String,
  isCustom: { type: Boolean, default: false },
  uses: { type: Number, default: 0 },
  server: { type: Schema.Types.ObjectId, ref: 'Server' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Number, default: Date.now },
});

export const ServerInviteModel = model<ServerInvite>('ServerInvite', schema);

