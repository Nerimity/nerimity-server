import {Router} from 'express';
import { login } from './login';
import { register } from './register';
import { userOpenDMChannel } from './userOpenDMChannel';

const UsersRouter = Router();

register(UsersRouter);
login(UsersRouter);
userOpenDMChannel(UsersRouter);

export {UsersRouter};