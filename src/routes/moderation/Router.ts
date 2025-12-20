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
import { useEditSuspension } from './userEditSuspension';
import { userBatchWarn } from './userBatchWarn';
import { announcementPostCreate } from './announcementPostCreate';
import { announcementPostRemove } from './announcementPostRemove';
import { getUsersAuditLog } from './getUsersAuditLog';
import { getMessages } from './getMessages';
import { serverUndoDelete } from './serverUndoDelete';
import { searchAuditLogs } from './searchAuditLogs';
import { exploreServerPinRemove } from './exploreServerPinRemove';
import { exploreServerPin } from './exploreServerPin';
import { userBatchShadowBan } from './userBatchShadowBan';
import { userBatchUndoShadowBan } from './userBatchUndoShadowBan';
import { getServersActive } from './getServersActive';
import { deleteSuggestModActions } from './deleteSuggestModActions';
import { listSuggestModActions } from './listSuggestModActions';
import { suggestModAction } from './suggestModAction';

const ModerationRouter = Router();

deleteSuggestModActions(ModerationRouter);
listSuggestModActions(ModerationRouter);
suggestModAction(ModerationRouter);

getServersActive(ModerationRouter);
exploreServerPinRemove(ModerationRouter);
exploreServerPin(ModerationRouter);

getMessages(ModerationRouter);

userBatchUndoShadowBan(ModerationRouter);
userBatchShadowBan(ModerationRouter);

userBatchWarn(ModerationRouter);

getUsersAuditLog(ModerationRouter);
getAuditLogs(ModerationRouter);
searchAuditLogs(ModerationRouter);
getStats(ModerationRouter);
userBatchUnsuspend(ModerationRouter);
userBatchSuspend(ModerationRouter);
useEditSuspension(ModerationRouter);

getUsersWithSameIPAddress(ModerationRouter);
searchUsers(ModerationRouter);
searchServers(ModerationRouter);
getUser(ModerationRouter);
updateUser(ModerationRouter);
getUsers(ModerationRouter);
getUsersOnline(ModerationRouter);

serverDelete(ModerationRouter);
serverUndoDelete(ModerationRouter);
getServer(ModerationRouter);
updateServer(ModerationRouter);
getServers(ModerationRouter);
getTicket(ModerationRouter);
getTickets(ModerationRouter);
ticketUpdate(ModerationRouter);

announcementPostCreate(ModerationRouter);
announcementPostRemove(ModerationRouter);
searchPosts(ModerationRouter);
getPosts(ModerationRouter);
postBatchSuspend(ModerationRouter);

export { ModerationRouter };
