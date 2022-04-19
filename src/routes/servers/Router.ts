import {Router} from 'express';
import { serverCreate } from './serverCreate';


const ServersRouter = Router();

serverCreate(ServersRouter);


export {ServersRouter};