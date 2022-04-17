import express from 'express';
import socketIO from 'socket.io';
import http from 'http';
import mongoose from 'mongoose';
import { registerUser } from './services/User';
const app = express();
const server = http.createServer(app);
const io = new socketIO.Server(server);
server.listen(80, async () => {
    console.log('listening on *:80');
    await mongoose.connect('mongodb://localhost:27017/test');
    await registerUser({
        email: 'test@test.test',
        password: 'test123',
        username: 'test'
    });
});
