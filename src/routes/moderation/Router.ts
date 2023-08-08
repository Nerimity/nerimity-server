import { Router } from 'express';
import { getServers } from './getServers';
import { getUsers } from './getUsers';
import { getUsersOnline } from './getUsersOnline';
import { userBatchSuspend } from './userBatchSuspend';
import { updateServer } from './updateServer';
import { getServer } from './getServer';
import { getUser } from './getUser';
import { updateUser } from './updateUser';
import { getStats } from './getStats';
import { userBatchUnsuspend } from './userBatchUnsuspend';
import { serverDelete } from '../servers/serverDelete';

const ModerationRouter = Router();

getStats(ModerationRouter);
userBatchUnsuspend(ModerationRouter);
userBatchSuspend(ModerationRouter);
getUser(ModerationRouter);
updateUser(ModerationRouter);
getUsers(ModerationRouter);
getUsersOnline(ModerationRouter);

serverDelete(ModerationRouter);
getServer(ModerationRouter);
updateServer(ModerationRouter);
getServers(ModerationRouter);

export { ModerationRouter };
