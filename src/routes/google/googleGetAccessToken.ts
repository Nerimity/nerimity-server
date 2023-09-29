import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { ConnectionProviders } from '../../services/UserConnection';
import { authenticate } from '../../middleware/authenticate';
import aes from '../../common/aes';
import env from '../../common/env';
import { prisma } from '../../common/database';
import { generateError } from '../../common/errorHandler';
import { googleOAuth2Client } from '../../common/GoogleOAuth2Client';
import { updateAccountCache } from '../../cache/UserCache';

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
  let encryptedRefreshToken = req.accountCache.googleRefreshToken;

  if (!encryptedRefreshToken) {
    const connection = await prisma.userConnection.findFirst({
      where: {
        provider: ConnectionProviders.Google,
        userId: req.accountCache.user.id,
      }
    });

    if (!connection) return res.status(400).json(generateError('You have not linked your Google account.'));
    encryptedRefreshToken = connection.refreshToken;
  }

  const decryptedRefreshToken = aes.decrypt(encryptedRefreshToken, env.CONNECTIONS_SECRET);
  const decryptedAccessToken = req.accountCache.googleAccessToken ? aes.decrypt(req.accountCache.googleAccessToken, env.CONNECTIONS_SECRET) : undefined;

  const oAuth2Client = googleOAuth2Client();

  oAuth2Client.setCredentials({
    access_token: decryptedAccessToken,
    refresh_token: decryptedRefreshToken
  })

  const newAccessTokenRes = await oAuth2Client.getAccessToken().catch(() => { });

  if (!newAccessTokenRes || !newAccessTokenRes.token) return res.status(400).json(generateError('Something went wrong.'));

  if (newAccessTokenRes.token !== decryptedAccessToken) {
    await updateAccountCache(req.accountCache.user.id, {
      googleAccessToken: aes.encrypt(newAccessTokenRes.token, env.CONNECTIONS_SECRET),
      googleRefreshToken: encryptedRefreshToken
    })
  }

  // get token expire time and set redis to expire the token.
  // oAuth2Client.getTokenInfo(newAccessTokenRes.token).then(res => console.log(res))

  res.json({ accessToken: newAccessTokenRes.token });
}