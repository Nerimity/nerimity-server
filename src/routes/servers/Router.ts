import {Router} from 'express';
import { serverCreate } from './serverCreate';
import { serverInviteCreate } from './serverInviteCreate';
import { serverInviteDetails } from './serverInviteDetails';
import { serverInviteJoin } from './serverInviteJoin';
import { serverInvites } from './ServerInvites';
import { serverSettingsUpdate } from './serverSettingsUpdate';


const ServersRouter = Router();

serverCreate(ServersRouter);
serverInviteJoin(ServersRouter);
serverInviteDetails(ServersRouter);
serverInviteCreate(ServersRouter);
serverInvites(ServersRouter);
serverSettingsUpdate(ServersRouter);


export {ServersRouter};