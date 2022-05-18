import {Router} from 'express';
import { friendAdd } from './friendAdd';



const FriendsRouter = Router();

friendAdd(FriendsRouter);


export {FriendsRouter};