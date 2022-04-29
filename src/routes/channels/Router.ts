import {Router} from 'express';
import { channelMessageCreate } from './channelMessageCreate';
import { channelMessages } from './channelMessages';


const ChannelsRouter = Router();

channelMessages(ChannelsRouter);
channelMessageCreate(ChannelsRouter);


export { ChannelsRouter };