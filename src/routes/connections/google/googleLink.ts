import { Request, Response, Router } from 'express';
import { rateLimit } from '../../../middleware/rateLimit';
import { body } from 'express-validator';

import { generateError } from '../../../common/errorHandler';
import jwt from 'jsonwebtoken';
import env from '../../../common/env';
import { addGoogleConnection } from '../../../services/UserConnection';
import { googleOAuth2Client } from '../../../common/GoogleOAuth2Client';

export function googleLink(Router: Router) {
  Router.post(
    '/connections/google/link-account',
    body('nerimityToken').not().isEmpty().withMessage('nerimityToken is required.').isString().withMessage('nerimityToken must be a string!'),
    body('code').not().isEmpty().withMessage('code is required.').isString().withMessage('code must be a string!'),
    rateLimit({
      name: 'google-link-account',
      restrictMS: 60000,
      requests: 10,
      useIP: true,
    }),
    route,
  );
}

interface Body {
  nerimityToken: string;
  code: string;
}

async function route(req: Request, res: Response) {
  const body: Body = req.body;

  const token = await verifyAsync(body.nerimityToken).catch(() => {});

  if (!token) {
    return res.status(400).json(generateError('Token expired. Please try again.'));
  }

  const { c, uId } = token as { c: 'google'; uId: string };

  if (c !== 'google') {
    return res.status(400).json(generateError('Invalid token.'));
  }

  const client = googleOAuth2Client();

  const getTokenRes = await client.getToken({ redirect_uri: `${env.CLIENT_URL}/connections/google-redirect`, code: body.code }).catch((e) => {
    console.log(e);
  });
  if (!getTokenRes) {
    return res.status(400).json(generateError('Invalid code.'));
  }

  const refreshToken = getTokenRes.tokens.refresh_token;

  if (!refreshToken) {
    return res.status(400).json(generateError('Invalid code.'));
  }

  if (!getTokenRes || !getTokenRes.tokens.id_token) {
    return res.status(400).json(generateError('Invalid code or missing ID token.'));
  }

  const ticket = await client.verifyIdToken({
    idToken: getTokenRes.tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const googleUserId = payload?.sub;
  if (!googleUserId) {
    return res.status(400).json(generateError('Invalid ID token payload.'));
  }

  const [connection, error] = await addGoogleConnection(uId, refreshToken, googleUserId);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ connection });
}

const verifyAsync = async (token: string) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, env.JWT_CONNECTIONS_SECRET, (err, decoded) => {
      if (err) return reject(err);
      return resolve(decoded);
    });
  });
