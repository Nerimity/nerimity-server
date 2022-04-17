import { Schema, model } from 'mongoose';
const schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    password: String,
    ipAddress: String
});
export const AccountModel = model('Account', schema);
