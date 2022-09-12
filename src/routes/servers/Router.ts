import {Router} from 'express';
import { serverChannelCreate } from './serverChannelCreate';
import { serverChannelDelete } from './serverChannelDelete';
import { serverChannelUpdate } from './serverChannelUpdate';
import { serverCreate } from './serverCreate';
import { serverInviteCreate } from './serverInviteCreate';
import { serverInviteDetails } from './serverInviteDetails';
import { serverInviteJoin } from './serverInviteJoin';
import { serverInvites } from './ServerInvites';
import { serverDeleteOrLeave } from './serverDeleteOrLeave';
import { serverSettingsUpdate } from './serverSettingsUpdate';
import { serverRoleCreate } from './serverRoleCreate';
import { serverRoleUpdate } from './serverRoleUpdate';
import { serverMemberUpdate } from './serveMemberUpdate';


const ServersRouter = Router();

serverCreate(ServersRouter);
serverDeleteOrLeave(ServersRouter);
serverSettingsUpdate(ServersRouter);

serverInviteJoin(ServersRouter);
serverInviteDetails(ServersRouter);
serverInviteCreate(ServersRouter);
serverInvites(ServersRouter);

serverChannelCreate(ServersRouter);
serverChannelUpdate(ServersRouter);
serverChannelDelete(ServersRouter);

serverRoleCreate(ServersRouter);
serverRoleUpdate(ServersRouter);

serverMemberUpdate(ServersRouter);

export {ServersRouter};