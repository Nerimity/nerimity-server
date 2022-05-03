import {Router} from 'express';
import { channelMessageCreate } from './channelMessageCreate';
import { channelMessageDelete } from './channelMessageDelete';
import { channelMessages } from './channelMessages';


const ChannelsRouter = Router();

channelMessages(ChannelsRouter);
channelMessageCreate(ChannelsRouter);
channelMessageDelete(ChannelsRouter);


export { ChannelsRouter };