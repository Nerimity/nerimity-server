import {Router} from 'express';
import { login } from './login';
import { register } from './register';
import { userDetails } from './userDetails';
import { userFollow } from './userFollow';
import { userFollowers } from './userFollowers';
import { userFollowing } from './userFollowing';
import { userOpenDMChannel } from './userOpenDMChannel';
import { userUnfollow } from './userUnfollow';
import { userUpdate } from './userUpdate';
import { userUpdatePresence } from './userUpdatePresence';

const UsersRouter = Router();

register(UsersRouter);
login(UsersRouter);
userUpdate(UsersRouter);

userOpenDMChannel(UsersRouter);
userUpdatePresence(UsersRouter);
userDetails(UsersRouter);
userFollow(UsersRouter);
userUnfollow(UsersRouter);
userFollowers(UsersRouter);
userFollowing(UsersRouter);

export {UsersRouter};