import {Router} from 'express';
import { login } from './login';
import { register } from './register';

const UsersRouter = Router();

register(UsersRouter);
login(UsersRouter);

export {UsersRouter};