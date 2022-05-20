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
exports.main = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = __importDefault(require("./common/env"));
const Log_1 = require("./common/Log");
const redis_1 = require("./common/redis");
const cors_1 = __importDefault(require("cors"));
const socket_1 = require("./socket/socket");
const Router_1 = require("./routes/users/Router");
const Router_2 = require("./routes/servers/Router");
const Router_3 = require("./routes/channels/Router");
const Router_4 = require("./routes/friends/Router");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
mongoose_1.default.connect(env_1.default.MONGODB_URI, () => {
    Log_1.Log.info('Connected to mongodb');
});
// eslint-disable-next-line no-async-promise-executor
const main = () => new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, redis_1.connectRedis)();
    Log_1.Log.info('Connected to Redis');
    (0, socket_1.createIO)(server);
    server.listen(env_1.default.PORT, () => {
        Log_1.Log.info('listening on *:' + env_1.default.PORT);
        resolve(server);
    });
}));
exports.main = main;
if (process.env.TEST !== 'true') {
    (0, exports.main)();
}
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use('/api', Router_1.UsersRouter);
app.use('/api', Router_2.ServersRouter);
app.use('/api', Router_3.ChannelsRouter);
app.use('/api', Router_4.FriendsRouter);
