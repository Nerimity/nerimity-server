import {Router} from 'express';
import { getServers } from './getServers';
import { getUsers } from './getUsers';
import { getUsersOnline } from './getUsersOnline';


const ModerationRouter = Router();

getUsers(ModerationRouter);
getUsersOnline(ModerationRouter);
getServers(ModerationRouter);

export {ModerationRouter};