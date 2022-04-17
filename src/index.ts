import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import env from './common/env';

import {createIO} from './common/socket';

const app = express();
const server = http.createServer(app);
createIO(server);

server.listen(80, async () => {
  console.log('listening on *:80');
  await mongoose.connect(env.MONGODB_URI);
});