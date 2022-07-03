import {Schema, model, Types} from 'mongoose';



export interface Inbox {
  createdBy: Types.ObjectId;
  closed: boolean;
  channel: Types.ObjectId;
  recipient: Types.ObjectId;
  createdAt: number
}

const schema = new Schema<Inbox>({
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  recipient: { type: Schema.Types.ObjectId, ref: 'User' },
  closed: { type: Boolean, default: false },
  channel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  createdAt: { type: Number, default: Date.now },
});

export const InboxModel = model<Inbox>('Inbox', schema);

