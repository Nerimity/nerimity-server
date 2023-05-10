import {Router} from 'express';
import { getServers } from './getServers';
import { getUsers } from './getUsers';
import { getUsersOnline } from './getUsersOnline';
import { userBatchSuspend } from './userBatchSuspend';
import { updateServer } from './updateServer';
import { getServer } from './getServer';


const ModerationRouter = Router();

getUsers(ModerationRouter);
getUsersOnline(ModerationRouter);
userBatchSuspend(ModerationRouter);


getServer(ModerationRouter);
updateServer(ModerationRouter);
getServers(ModerationRouter);

export {ModerationRouter};