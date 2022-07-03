import {Schema, model, Types} from 'mongoose';

interface MessageMention {
  _id: Types.ObjectId
  mentionedBy: Types.ObjectId
  mentionedTo: Types.ObjectId
  channel: Types.ObjectId
  server?: Types.ObjectId
  count: number
  createdAt?: number
}

const schema = new Schema<MessageMention>({
  mentionedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  mentionedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  channel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  server: { type: Schema.Types.ObjectId, ref: 'Server' },
  count: { type: Number, default: 0 },
  createdAt: {type: Number, default: Date.now}
});

export const MessageMentionModel = model<MessageMention>('MessageMention', schema);

