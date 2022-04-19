import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import env from './common/env';
import { Log } from './common/Log';
import { connectRedis } from './common/redis';
import cors from 'cors';

import {createIO} from './socket/socket';
import { UsersRouter } from './routes/users/Router';
import { ServersRouter } from './routes/servers/Router';

const app = express();
const server = http.createServer(app);
createIO(server);

mongoose.connect(env.MONGODB_URI, () => {
  Log.info('Connected to mongodb');
});

connectRedis().then(() => {
  Log.info('Connected to Redis');
});


app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api', UsersRouter);
app.use('/api', ServersRouter);


server.listen(env.PORT, async () => {
  Log.info('listening on *:' + env.PORT);
});