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
import { serverDelete } from './serverDelete';
import { searchUsers } from './searchUsers';
import { getUsersWithSameIPAddress } from './getUsersWithSameIPAddress';
import { searchServers } from './searchServers';
import { getAuditLogs } from './getAuditLogs';
import { getTickets } from './getTickets';
import { getTicket } from './getTicket';
import { ticketUpdate } from './updateTicketStatus';
import { searchPosts } from './searchPosts';
import { getPosts } from './getPosts';
import { postBatchSuspend } from './postBatchDelete';

const ModerationRouter = Router();

getAuditLogs(ModerationRouter);
getStats(ModerationRouter);
userBatchUnsuspend(ModerationRouter);
userBatchSuspend(ModerationRouter);
getUsersWithSameIPAddress(ModerationRouter);
searchUsers(ModerationRouter);
searchServers(ModerationRouter);
getUser(ModerationRouter);
updateUser(ModerationRouter);
getUsers(ModerationRouter);
getUsersOnline(ModerationRouter);

serverDelete(ModerationRouter);
getServer(ModerationRouter);
updateServer(ModerationRouter);
getServers(ModerationRouter);
getTicket(ModerationRouter);
getTickets(ModerationRouter);
ticketUpdate(ModerationRouter);

searchPosts(ModerationRouter);
getPosts(ModerationRouter);
postBatchSuspend(ModerationRouter);

export { ModerationRouter };
