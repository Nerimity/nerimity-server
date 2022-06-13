import {Router} from 'express';
import { login } from './login';
import { register } from './register';
import { userOpenDMChannel } from './userOpenDMChannel';
import { userUpdatePresence } from './userUpdatePresence';

const UsersRouter = Router();

register(UsersRouter);
login(UsersRouter);
userOpenDMChannel(UsersRouter);
userUpdatePresence(UsersRouter);

export {UsersRouter};