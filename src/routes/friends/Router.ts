import {Router} from 'express';
import { friendAccept } from './friendAccept';
import { friendAdd } from './friendAdd';
import { friendRemove } from './friendRemove';



const FriendsRouter = Router();

friendAdd(FriendsRouter);
friendAccept(FriendsRouter);
friendRemove(FriendsRouter);


export {FriendsRouter};