import * as socketIO from 'socket.io';
import { decryptToken } from '../common/JWT';
import env from '../common/env';
import { getIO } from '../socket/socket';
import { getExternalServerChannel } from '../services/ExternalServerChannel';
import { scope, type } from 'arktype';
import { string } from 'arktype/internal/keywords/string.ts';
import { number } from 'arktype/internal/keywords/number.ts';

interface GetMessagesPayload {
  name: 'get_messages';
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
}
interface CreateMessagesPayload {
  name: 'create_message';
  data?: any;
}

type Payload = GetMessagesPayload | CreateMessagesPayload;

let externalServerChannelIo: socketIO.Namespace;

export async function createExternalServerClientIo() {
  externalServerChannelIo = getIO().of('/external-server-channel');

  externalServerChannelIo.on('connection', (socket) => {
    let authenticateRan = false;

    socket.on('authenticate', async (payload) => {
      if (authenticateRan) return;
      authenticateRan = true;
      onAuthenticate(socket, payload);
    });
  });
}

async function onAuthenticate(socket: socketIO.Socket, payload: { version: string; token: string }) {
  let authenticated = false;
  const tokenData = decryptToken(payload.token, env.JWT_EXTERNAL_SERVER_CHANNEL_SECRET);

  let authTimeout: NodeJS.Timeout | null = setTimeout(() => {
    if (!authenticated && socket.connected) {
      socket.emit('authenticateError', { message: 'Authentication timed out' });
      socket.disconnect();
    }
  }, 30000);

  if (!tokenData) {
    socket.emit('authenticateError', { message: 'Invalid token' });
    socket.disconnect();
    return;
  }

  const id = tokenData.userId;
  const passwordVersion = tokenData.passwordVersion;

  const externalServerChannel = await getExternalServerChannel(id);

  if (!externalServerChannel) {
    socket.emit('authenticateError', { message: 'Invalid token' });
    socket.disconnect();
    return;
  }

  if (externalServerChannel.passwordVersion !== passwordVersion) {
    socket.emit('authenticateError', { message: 'Invalid token' });
    socket.disconnect();
    return;
  }

  // check if already connected
  const connectedSockets = await externalServerChannelIo.in(externalServerChannel.channelId).fetchSockets();
  if (connectedSockets.length > 0) {
    socket.emit('authenticateError', { message: 'Already connected' });
    socket.disconnect();
    return;
  }

  authenticated = true;
  clearTimeout(authTimeout);
  if (socket.connected) {
    authTimeout = null;
    socket.join(externalServerChannel.channelId);
    socket.emit('authenticated', { serverName: externalServerChannel.server.name, channelName: externalServerChannel.channel.name });
  }
}

export async function fetchFromExternalIo(channelId: string, payload: Payload): Promise<[any, null] | [null, string]> {
  return externalServerChannelIo
    .to(channelId)
    .timeout(10000)
    .emitWithAck('d', payload)
    .then((res) => (res.length ? res[0] : [null, 'Host is offline.']))
    .catch(() => [null, 'Host is offline.']);
}

const types = scope({
  Attachment: {
    id: 'string',
    'height?': 'number < 5000',
    'width?': 'number < 5000',
    'filesize?': 'number < 1000000',
    provider: 'string < 100',
    fileId: 'string < 100',
    'mime?': 'string < 100',
    createdAt: 'number < 999999999999999999',
  },
  Reaction: {
    id: 'string < 100',
    name: 'string < 100',
    'emojiId?': 'string < 100',
    'gif?': 'boolean',
    messageId: 'string < 100',
  },
  Button: {
    id: 'string < 100',
    label: 'string < 100',
    'alert?': 'boolean',
  },

  ReplyMessage: {
    replyToMessage: {
      id: 'string < 100',
      createdById: 'string < 100',
      createdAt: 'number < 999999999999999999',
      editedAt: 'number < 999999999999999999 | null',
      content: 'string < 2000',
      attachments: 'Attachment[] < 20',
    },
  },
  QuotedMessage: {
    id: 'string < 100',
    content: 'string < 2000',
    editedAt: 'number < 999999999999999999 | null',
    createdById: 'string < 100',
    createdAt: 'number < 999999999999999999',
    channelId: 'string < 100',
    attachments: 'Attachment[] < 20',
  },
  ExternalMessage: {
    id: 'string',
    'content?': 'string < 2000',
    type: 'number < 100',
    channelId: 'string < 100',
    createdById: 'string < 100',
    editedAt: 'number < 999999999999999999 | null',
    createdAt: 'number < 999999999999999999',
    roleMentions: 'string < 100 [] < 20',
    embed: 'object | null',
    htmlEmbed: 'string < 5000 | null',
    mentionReplies: 'boolean | null',
    silent: 'boolean | null',
    replyMessages: 'ReplyMessage[] < 20',
    buttons: 'Button[] < 20',
    quotedMessages: 'QuotedMessage[] < 20', // Use the name of the type from the scope
    attachments: 'Attachment[] < 20', // Use the name of the type from the scope
    reactions: 'Reaction[] < 20', // Use the name of the type from the scope
    mentions: 'string < 100 [] < 20',
  },
}).export();

export const ExternalMessage = types.ExternalMessage;
export const ExternalMessages = ExternalMessage.array();
