"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountByUserId = exports.loginUser = exports.registerUser = void 0;
const AccountModel_1 = require("../models/AccountModel");
const UserModel_1 = require("../models/UserModel");
const bcrypt_1 = __importDefault(require("bcrypt"));
const random_1 = require("../common/random");
const JWT_1 = require("../common/JWT");
const errorHandler_1 = require("../common/errorHandler");
const registerUser = (opts) => __awaiter(void 0, void 0, void 0, function* () {
    const account = yield AccountModel_1.AccountModel.findOne({ email: opts.email });
    if (account) {
        return [null, (0, errorHandler_1.generateError)('Email already exists.', 'email')];
    }
    const tag = (0, random_1.generateTag)();
    const usernameTagExists = yield UserModel_1.UserModel.exists({ username: opts.username, tag });
    if (usernameTagExists) {
        return [null, (0, errorHandler_1.generateError)('This username is used too often.', 'username')];
    }
    const hashedPassword = yield bcrypt_1.default.hash(opts.password.trim(), 10);
    const newUser = yield UserModel_1.UserModel.create({
        username: opts.username.trim(),
        tag
    });
    const newAccount = yield AccountModel_1.AccountModel.create({
        email: opts.email,
        user: newUser._id,
        password: hashedPassword,
        passwordVersion: 0,
    });
    newUser.account = newAccount._id;
    yield newUser.save();
    const token = (0, JWT_1.generateToken)(newUser.id, newAccount.passwordVersion);
    return [token, null];
});
exports.registerUser = registerUser;
const loginUser = (opts) => __awaiter(void 0, void 0, void 0, function* () {
    const account = yield AccountModel_1.AccountModel.findOne({ email: opts.email });
    if (!account) {
        return [null, (0, errorHandler_1.generateError)('Invalid email address.', 'email')];
    }
    const isPasswordValid = yield bcrypt_1.default.compare(opts.password, account.password);
    if (!isPasswordValid) {
        return [null, (0, errorHandler_1.generateError)('Invalid password.', 'password')];
    }
    const token = (0, JWT_1.generateToken)(account.user.toString(), account.passwordVersion);
    return [token, null];
});
exports.loginUser = loginUser;
const getAccountByUserId = (userId) => {
    return AccountModel_1.AccountModel.findOne({ user: userId }).populate('user');
};
exports.getAccountByUserId = getAccountByUserId;
