import {Router} from 'express';
import { getServers } from './getServers';
import { getUsers } from './getUsers';
import { getUsersOnline } from './getUsersOnline';
import { userBatchSuspend } from './userBatchSuspend';


const ModerationRouter = Router();

getUsers(ModerationRouter);
getUsersOnline(ModerationRouter);
getServers(ModerationRouter);
userBatchSuspend(ModerationRouter);

export {ModerationRouter};