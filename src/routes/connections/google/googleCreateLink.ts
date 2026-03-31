import { Request, Response, Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { rateLimit } from '../../../middleware/rateLimit';
import jwt from 'jsonwebtoken';
import env from '../../../common/env';
import { googleOAuth2Client } from '../../../common/GoogleOAuth2Client';
export function googleCreateLink(Router: Router) {
  Router.get(
    '/connections/google/create-link',
    authenticate({ allowNoToken: true }),
    rateLimit({
      name: 'google-create-link',
      restrictMS: 60000,
      requests: 3,
    }),
    route,
  );
}

function route(req: Request, res: Response) {
  const client = googleOAuth2Client();
  const login = req.query.login === 'true';

  if (!login && !req.userCache) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url = client.generateAuthUrl({
    access_type: 'offline',
    redirect_uri: login ? `${env.CLIENT_URL}/login` : `${env.CLIENT_URL}/connections/google-redirect`,
    scope: ['openid'],
    prompt: 'consent',
    state: login ? undefined : jwt.sign({ uId: req.userCache.id, c: 'google' }, env.JWT_CONNECTIONS_SECRET, { expiresIn: 300, header: { alg: 'HS256', typ: undefined } }), // 5 minutes
  });

  res.send(url);
}
