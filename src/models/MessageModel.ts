import {Schema, model, Types} from 'mongoose';


export interface MessageType {
  CONTENT: 0;
  JOIN_SERVER: 1;
  LEAVE_SERVER: 2;
  KICK_USER: 3;
  BAN_USER: 4;
}

export interface Message {
  content: string,
  type: MessageType,
  channel: Types.ObjectId
  creator: Types.ObjectId
  editedAt?: number 
  createdAt: number
}

const schema = new Schema<Message>({
  content: String,
  type: Number,
  channel: { type: Schema.Types.ObjectId, ref: 'Channel' },
  creator: { type: Schema.Types.ObjectId, ref: 'User' },
  editedAt: Number,
  createdAt: { type: Number, default: Date.now },
});

export const UserModel = model<Message>('Message', schema);

