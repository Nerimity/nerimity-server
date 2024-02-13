import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { ConnectionProviders } from '../../services/UserConnection';
import { authenticate } from '../../middleware/authenticate';
import aes from '../../common/aes';
import env from '../../common/env';
import { prisma } from '../../common/database';
import { generateError } from '../../common/errorHandler';
import { googleOAuth2Client } from '../../common/GoogleOAuth2Client';
import {
  addGoogleAccessTokenCache,
  getGoogleAccessTokenCache,
} from '../../cache/UserCache';

export function googleGetAccessToken(Router: Router) {
  Router.get(
    '/google/access-token',
    authenticate(),

    rateLimit({
      name: 'google-get-access-token',
      expireMS: 60000,
      requestCount: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const encryptedAccessToken = await getGoogleAccessTokenCache(
    req.userCache.id
  );

  const accessToken = encryptedAccessToken
    ? aes.decrypt(encryptedAccessToken, env.CONNECTIONS_SECRET)
    : undefined;
  if (accessToken) return res.json({ accessToken });

  const connection = await prisma.userConnection.findFirst({
    where: {
      provider: ConnectionProviders.Google,
      userId: req.userCache.id,
    },
  });

  if (!connection)
    return res
      .status(400)
      .json(generateError('You have not linked your Google account.'));

  const refreshToken = aes.decrypt(
    connection.refreshToken,
    env.CONNECTIONS_SECRET
  );
  const oAuth2Client = googleOAuth2Client();

  oAuth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const newAccessTokenRes = await oAuth2Client.getAccessToken().catch(() => {});
  if (!newAccessTokenRes?.token)
    return res.status(400).json(generateError('Something went wrong.'));

  await addGoogleAccessTokenCache(
    req.userCache.id,
    aes.encrypt(newAccessTokenRes.token, env.CONNECTIONS_SECRET)
  );

  res.json({ accessToken: newAccessTokenRes.token });
}
