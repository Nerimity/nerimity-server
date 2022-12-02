import {Router} from 'express';
import { login } from './login';
import { register } from './register';
import { userDetails } from './userDetails';
import { userOpenDMChannel } from './userOpenDMChannel';
import { userUpdate } from './userUpdate';
import { userUpdatePresence } from './userUpdatePresence';

const UsersRouter = Router();

register(UsersRouter);
login(UsersRouter);
userUpdate(UsersRouter);

userOpenDMChannel(UsersRouter);
userUpdatePresence(UsersRouter);
userDetails(UsersRouter);

export {UsersRouter};