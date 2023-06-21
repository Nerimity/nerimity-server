import admin from 'firebase-admin';
import { cert } from 'firebase-admin/app';
import { prisma } from '../common/database';
import { removeFCMTokens } from '../services/User';
import { Message, User } from '@prisma/client';
import { addToObjectIfExists } from '../common/addToObjectIfExists';

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
  }
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
      content: message.content,
      type: message.type.toString(),
      creatorUserId: message.createdBy.id,
      creatorUsername: message.createdBy.username,
      ...addToObjectIfExists('creatorAvatar', message.createdBy.avatar),
      ...addToObjectIfExists('creatorHexColor', message.createdBy.hexColor),
    },
  });

  const failedTokens = batchResponse.responses
    .map((sendResponse, index) => sendResponse.error && tokens[index])
    .filter((token) => token) as string[];

  if (!failedTokens.length) return;
  removeFCMTokens(failedTokens);
}
