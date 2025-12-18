import { Router } from 'express';
import { channelMessageCreate } from './channelMessageCreate';
import { channelMessageDelete } from './channelMessageDelete';
import { channelMessages } from './channelMessages';
import { channelMessageUpdate } from './channelMessageUpdate';
import { channelTypingIndicator } from './channelTypingIndicator';
import { channelAttachments } from './channelAttachments';
import { channelMessageReactionsAdd } from './channelMessageReactionsAdd';
import { channelMessageReactionsRemove } from './channelMessageReactionsRemove';
import { channelMessageReactedUsers } from './channelMessageReactions';
import { channelDMClose } from './channelDmClose';
import { channelVoiceJoin } from './channelVoiceJoin';
import { channelVoiceLeave } from './channelVoiceLeave';
import { channelNoticeGet } from './channelNoticeGet';
import { channelMessageButtonClick } from './channelMessageButtonClick';
import { channelMessageButtonClickCallback } from './channelMessageButtonClickCallback';
import { channelGet } from './channelGet';
import { voiceGenerateCredentials } from './channelVoiceGenerateCredentials';
import { channelMessagesSingle } from './channelMessagesSingle';
import { channelMessageMarkUnread } from './channelMessageMarkUnread';
import { channelMessagePinAdd } from './channelMessagePinAdd';
import { channelMessagePinRemove } from './channelMessagePinRemove';
import { channelMessagePinsGet } from './channelMessagePinsGet';
import { channelMessagesSearch } from './channelMessagesSearch';

const ChannelsRouter = Router();

channelMessagePinAdd(ChannelsRouter);
channelMessagePinRemove(ChannelsRouter);
channelMessagePinsGet(ChannelsRouter);

voiceGenerateCredentials(ChannelsRouter);

channelMessageButtonClick(ChannelsRouter);
channelMessageButtonClickCallback(ChannelsRouter);

channelMessageMarkUnread(ChannelsRouter);
channelGet(ChannelsRouter);
channelNoticeGet(ChannelsRouter);
channelMessages(ChannelsRouter);
channelMessagesSearch(ChannelsRouter);
channelMessagesSingle(ChannelsRouter);
channelVoiceJoin(ChannelsRouter);
channelVoiceLeave(ChannelsRouter);
channelAttachments(ChannelsRouter);

channelMessageCreate(ChannelsRouter);
channelMessageUpdate(ChannelsRouter);
channelMessageDelete(ChannelsRouter);
channelTypingIndicator(ChannelsRouter);

channelMessageReactedUsers(ChannelsRouter);
channelMessageReactionsAdd(ChannelsRouter);
channelMessageReactionsRemove(ChannelsRouter);

channelDMClose(ChannelsRouter);

export { ChannelsRouter };
