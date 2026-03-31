import { Request, Response, Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { rateLimit } from '../../../middleware/rateLimit';
import jwt from 'jsonwebtoken';
import env from '../../../common/env';
import { googleOAuth2Client } from '../../../common/GoogleOAuth2Client';
export function googleDriveCreateLink(Router: Router) {
  Router.get(
    '/connections/google-drive/create-link',
    authenticate(),
    rateLimit({
      name: 'google-d-create-link',
      restrictMS: 60000,
      requests: 3,
    }),
    route,
  );
}

function route(req: Request, res: Response) {
  const client = googleOAuth2Client();

  const url = client.generateAuthUrl({
    access_type: 'offline',
    redirect_uri: `${env.CLIENT_URL}/connections/google-drive-redirect`,
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent',
    state: jwt.sign({ uId: req.userCache.id, c: 'google' }, env.JWT_CONNECTIONS_SECRET, { expiresIn: 300, header: { alg: 'HS256', typ: undefined } }), // 5 minutes
  });

  res.send(url);
}
