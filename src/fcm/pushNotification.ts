import admin from 'firebase-admin';
import { cert } from 'firebase-admin/app';
import { prisma } from '../common/database';
import { removeFCMTokens } from '../services/User';
import { Message, User } from '@prisma/client';
import { addToObjectIfExists } from '../common/addToObjectIfExists';
import { ChannelCache } from '../cache/ChannelCache';
import { ServerCache } from '../cache/ServerCache';

let credentials: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  credentials = require('../fcm-credentials.json');
} catch {
  console.log(
    'Warning> fcm-credentials.json was not provided. Mobile push notifications will not work.'
  );
}

if (credentials) {
  admin.initializeApp({
    credential: cert(credentials),
  });
}

export async function sendServerPushMessageNotification(
  serverId: string,
  message: Message & {
    createdBy: {
      id: string;
      username: string;
      avatar?: string | null;
      hexColor: string | null;
    };
  },
  channel: ChannelCache,
  server: ServerCache
) {
  if (!credentials) return;
  const tokens = (
    await prisma.firebaseMessagingToken.findMany({
      where: { account: { user: { servers: { some: { id: serverId } } } } },
      select: { token: true },
    })
  ).map((fcm) => fcm.token);
  if (!tokens.length) return;

  const batchResponse = await admin.messaging().sendEachForMulticast({
    tokens,
    android: { priority: 'high' },
    data: {
      ...addToObjectIfExists('content', message?.content?.substring(0, 50)),
      type: message.type.toString(),
      channelName: channel.name!,
      serverName: server.name,
      channelId: message.channelId,
      serverId,
      cUserId: message.createdBy.id,
      cName: message.createdBy.username,
      ...addToObjectIfExists('cAvatar', message.createdBy.avatar),
      ...addToObjectIfExists('cHexColor', message.createdBy.hexColor),
    },
  });

  const failedTokens = batchResponse.responses
    .map((sendResponse, index) => sendResponse.error && tokens[index])
    .filter((token) => token) as string[];

  if (!failedTokens.length) return;
  removeFCMTokens(failedTokens);
}
