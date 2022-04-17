import { Schema, model } from 'mongoose';
const schema = new Schema({
    account: { type: Schema.Types.ObjectId, ref: 'Account' },
    username: String,
    tag: String,
    avatar: String
});
export const UserModel = model('User', schema);
