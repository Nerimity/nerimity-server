import {Router} from 'express';
import { getUsers } from './getUsers';


const ModerationRouter = Router();

getUsers(ModerationRouter);

export {ModerationRouter};