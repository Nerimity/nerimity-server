import { updateAccountCache } from '../cache/UserCache';
import { googleOAuth2Client } from '../common/GoogleOAuth2Client';
import aes from '../common/aes';
import { prisma } from '../common/database';
import env from '../common/env';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { emitUserConnectionAdded, emitUserConnectionRemoved } from '../emits/User';

export const ConnectionProviders = {
  Google: 'GOOGLE',
} as const;

export type ConnectionProvider = keyof typeof ConnectionProviders;

export const addGoogleConnection = async (
  userId: string,
  refreshToken: string
) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) return [null, generateError('Invalid user Id')] as const;

  const [_, newConnection] = await prisma.$transaction([
    prisma.userConnection.deleteMany({
      where: { provider: ConnectionProviders.Google, userId },
    }),
    prisma.userConnection.create({
      data: {
        id: generateId(),
        provider: ConnectionProviders.Google,
        userId,
        refreshToken: aes.encrypt(refreshToken, env.CONNECTIONS_SECRET),
        public: false,
      },
      select: { id: true, provider: true, connectedAt: true }
    }),
  ]);

  emitUserConnectionAdded(userId, newConnection);

  return [newConnection, null] as const;
};


export const removeGoogleConnection = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) return [null, generateError('Invalid user Id')] as const;

  const connection = await prisma.userConnection.findFirst({
    where: {
      provider: ConnectionProviders.Google,
      userId,
    }
  })
  if (!connection) return [null, generateError('Account not connected to Google.')] as const;

  const refreshToken = aes.decrypt(connection.refreshToken, env.CONNECTIONS_SECRET);
  const oAuth2Client = googleOAuth2Client(refreshToken);
  await oAuth2Client.revokeCredentials().catch(() => { })


  await prisma.userConnection.delete({
    where: {
      id: connection.id,
    },
  });
  emitUserConnectionRemoved(userId, connection.id);

  updateAccountCache(userId, {
    googleAccessToken: undefined,
    googleRefreshToken: undefined
  })

  return [true, null] as const;


}