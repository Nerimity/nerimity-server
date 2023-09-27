import aes from '../common/aes';
import { prisma } from '../common/database';
import env from '../common/env';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';

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

  await prisma.$transaction([
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
    }),
  ]);
};
