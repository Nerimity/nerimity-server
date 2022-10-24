import {Router} from 'express';
import { channelMessageCreate } from './channelMessageCreate';
import { channelMessageDelete } from './channelMessageDelete';
import { channelMessages } from './channelMessages';
import { channelMessageUpdate } from './channelMessageUpdate';
import { channelTypingIndicator } from './channelTypingIndicator';


const ChannelsRouter = Router();

channelMessages(ChannelsRouter);
channelMessageCreate(ChannelsRouter);
channelMessageUpdate(ChannelsRouter);
channelMessageDelete(ChannelsRouter);
channelTypingIndicator(ChannelsRouter);


export { ChannelsRouter };