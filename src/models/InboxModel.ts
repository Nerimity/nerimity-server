import {Schema, model, Types} from 'mongoose';



export interface Inbox {
  user: Types.ObjectId;
  closed: boolean;
  channel: Types.ObjectId;
  createdAt: number
}

const schema = new Schema<Inbox>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  closed: { type: Boolean, default: false },
  channel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  createdAt: { type: Number, default: Date.now },
});

export const InboxModel = model<Inbox>('Inbox', schema);

