import {Router} from 'express';
import { serverCreate } from './serverCreate';
import { serverInviteCreate } from './serverInviteCreate';


const ServersRouter = Router();

serverCreate(ServersRouter);
serverInviteCreate(ServersRouter);


export {ServersRouter};