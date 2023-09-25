import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { googleOAuth2Client } from '../../middleware/GoogleOAuth2Client';
import { rateLimit } from '../../middleware/rateLimit';

export function createGoogleAuthLink(Router: Router) {
  Router.get(
    '/google/create-link',
    authenticate(),
    googleOAuth2Client,
    rateLimit({
      name: 'google-create-link',
      expireMS: 60000,
      requestCount: 3,
    }),
    route
  );
}

function route(req: Request, res: Response) {
  const url = req.GoogleOAuth2Client!.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent',
    state: req.headers.authorization,
  });

  res.send(url);
}
