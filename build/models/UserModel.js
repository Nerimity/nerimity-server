"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.UserStatus = void 0;
const mongoose_1 = require("mongoose");
const random_1 = require("../common/random");
var UserStatus;
(function (UserStatus) {
    UserStatus[UserStatus["OFFLINE"] = 0] = "OFFLINE";
    UserStatus[UserStatus["ONLINE"] = 1] = "ONLINE";
    UserStatus[UserStatus["LTP"] = 2] = "LTP";
    UserStatus[UserStatus["AFK"] = 3] = "AFK";
    UserStatus[UserStatus["DND"] = 4] = "DND";
})(UserStatus = exports.UserStatus || (exports.UserStatus = {}));
const schema = new mongoose_1.Schema({
    account: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Account', select: false },
    username: String,
    tag: String,
    avatar: String,
    status: { type: Number, default: UserStatus.ONLINE, select: false },
    hexColor: { type: String, default: random_1.generateHexColor },
    servers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Server', select: false }],
    friends: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Friend', select: false }],
    bot: Boolean,
    joinedAt: { type: Number, default: Date.now },
});
exports.UserModel = (0, mongoose_1.model)('User', schema);
