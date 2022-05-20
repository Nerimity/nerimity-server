"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountModel = void 0;
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, unique: true },
    password: String,
    passwordVersion: Number,
    ipAddress: String,
});
exports.AccountModel = (0, mongoose_1.model)('Account', schema);
