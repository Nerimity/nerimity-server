import { Router } from 'express';
import { serverChannelCreate } from './serverChannelCreate';
import { serverChannelDelete } from './serverChannelDelete';
import { serverChannelUpdate } from './serverChannelUpdate';
import { serverCreate } from './serverCreate';
import { serverInviteCreate } from './serverInviteCreate';
import { serverInviteDetails } from './serverInviteDetails';
import { serverInviteJoin } from './serverInviteJoin';
import { serverInvites } from './ServerInvites';
import { serverUpdate } from './serverUpdate';
import { serverRoleCreate } from './serverRoleCreate';
import { serverRoleUpdate } from './serverRoleUpdate';
import { serverMemberUpdate } from './serveMemberUpdate';
import { serverRoleDelete } from './serverRoleDelete';
import { serverMemberKick } from './serverMemberKick';
import { serverMemberBan } from './serverMemberBan';
import { serverMemberBanList } from './serverMemberBanList';
import { serverMemberBanRemove } from './serverMemberBanRemove';
import { serverInviteCustomCreate } from './serverInviteCustomCreate';
import { serverRoleUpdateOrder } from './serverRoleUpdateOrder';
import { serverUpdateOrder } from './serverUpdateOrder';
import { serverChannelUpdateOrder } from './serverChannelUpdateOrder';
import { serverEmojiAdd } from './serverEmojiAdd';
import { serverEmojisGet } from './serverEmojisGet';
import { serverEmojiUpdate } from './serverEmojiUpdate';
import { serverEmojiDelete } from './serverEmojisDelete';
import { serverInviteDelete } from './serverInviteDelete';
import { serverLeave } from './serverLeave';
import { serverDelete } from './serverDelete';
import { serverChannelNoticeDelete } from './ServerChannelNoticeDelete';
import { serverChannelNoticeUpdate } from './ServerChannelNoticeUpdate';
import { serverInviteBotJoin } from './serverInviteBot';
import { serverWelcomeQuestionCreate } from './serverWelcomeQuestionCreate';
import { serverWelcomeQuestionsGet } from './serverWelcomeQuestionsGet';
import { serverWelcomeQuestionGet } from './serverWelcomeQuestionGet';
import { serverWelcomeQuestionUpdate } from './serverWelcomeQuestionUpdate';
import { serverWelcomeQuestionDelete } from './serverWelcomeQuestionDelete';
import { serverWelcomeAnswer } from './serverWelcomeAnswer';
import { serverWelcomeAnswerRemove } from './serverWelcomeAnswerRemove';
import { serverMemberProfileUpdate } from './serveMemberProfileUpdate';
import { serverAuditLogsGet } from './serverAuditlogsGet';
import { serverChannelPermissionUpdate } from './serverChannelPermissionsUpdate';
import { serverTransferOwnership } from './serverTransferOwnership';
import { serverBotCommandsGet } from './serverBotCommandsGet';
import { serverExternalEmbedGet } from './serverExternalEmbedGet';
import { serverExternalEmbedCreate } from './serverExternalEmbedCreate';
import { serverExternalEmbedDelete } from './serverExternalEmbedDelete';
import { serverExternalEmbedRawGet } from './serverExternalEmbedRawGet ';
import { serverFolderCreate } from './serverFolderCreate';
import { serverFolderUpdate } from './serverFolderUpdate';
import { serverExternalChannelGenerateToken } from './ServerExternalChannelGenerateToken';

const ServersRouter = Router();

serverExternalEmbedGet(ServersRouter);
serverExternalEmbedRawGet(ServersRouter);
serverExternalEmbedCreate(ServersRouter);
serverExternalEmbedDelete(ServersRouter);

serverBotCommandsGet(ServersRouter);

serverExternalChannelGenerateToken(ServersRouter);

serverChannelNoticeDelete(ServersRouter);
serverChannelNoticeUpdate(ServersRouter);

serverTransferOwnership(ServersRouter);
serverChannelUpdateOrder(ServersRouter);
serverUpdateOrder(ServersRouter);
serverFolderCreate(ServersRouter);
serverFolderUpdate(ServersRouter);
serverCreate(ServersRouter);
serverDelete(ServersRouter);
serverLeave(ServersRouter);
serverUpdate(ServersRouter);
serverAuditLogsGet(ServersRouter);
serverInviteJoin(ServersRouter);
serverInviteDetails(ServersRouter);
serverInviteCreate(ServersRouter);
serverInviteDelete(ServersRouter);
serverInviteCustomCreate(ServersRouter);
serverInvites(ServersRouter);
serverInviteBotJoin(ServersRouter);

serverChannelCreate(ServersRouter);
serverRoleUpdateOrder(ServersRouter);
serverChannelUpdate(ServersRouter);
serverChannelDelete(ServersRouter);
serverChannelPermissionUpdate(ServersRouter);

serverRoleCreate(ServersRouter);
serverRoleUpdate(ServersRouter);
serverRoleDelete(ServersRouter);

serverMemberProfileUpdate(ServersRouter);

serverMemberUpdate(ServersRouter);
serverMemberKick(ServersRouter);
serverMemberBan(ServersRouter);
serverMemberBanList(ServersRouter);
serverMemberBanRemove(ServersRouter);

serverEmojiAdd(ServersRouter);
serverEmojisGet(ServersRouter);
serverEmojiUpdate(ServersRouter);
serverEmojiDelete(ServersRouter);

serverWelcomeQuestionCreate(ServersRouter);
serverWelcomeQuestionsGet(ServersRouter);
serverWelcomeQuestionGet(ServersRouter);
serverWelcomeQuestionUpdate(ServersRouter);
serverWelcomeQuestionDelete(ServersRouter);

serverWelcomeAnswer(ServersRouter);
serverWelcomeAnswerRemove(ServersRouter);

export { ServersRouter };
