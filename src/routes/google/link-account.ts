import { Request, Response, Router } from 'express';
import { googleOAuth2Client } from '../../middleware/GoogleOAuth2Client';
import { rateLimit } from '../../middleware/rateLimit';
import { body } from 'express-validator';

import { generateError } from '../../common/errorHandler';
import jwt from 'jsonwebtoken';
import env from '../../common/env';
import { addGoogleConnection } from '../../services/Connection';

export function linkAccountWithGoogle(Router: Router) {
  Router.post(
    '/google/link-account',
    body('nerimityToken')
      .not()
      .isEmpty()
      .withMessage('nerimityToken is required.')
      .isString()
      .withMessage('nerimityToken must be a string!'),
    body('code')
      .not()
      .isEmpty()
      .withMessage('code is required.')
      .isString()
      .withMessage('code must be a string!'),
    googleOAuth2Client,
    rateLimit({
      name: 'google-link-account',
      expireMS: 60000,
      requestCount: 3,
    }),
    route
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
    return res
      .status(400)
      .json(generateError('Token expired. Please try again.'));
  }

  const { c, uid } = token as { c: 'google'; uid: string };

  if (c !== 'google') {
    return res.status(400).json(generateError('Invalid token.'));
  }

  const client = req.GoogleOAuth2Client!;

  const getTokenRes = await client.getToken(body.code).catch(() => {});
  if (!getTokenRes) {
    return res.status(400).json(generateError('Invalid code.'));
  }

  const refreshToken = getTokenRes.tokens.refresh_token;

  if (!refreshToken) {
    return res.status(400).json(generateError('Invalid code.'));
  }

  client.setCredentials({ refresh_token: refreshToken });
  const accessTokenRes = await client.getAccessToken();
  console.log(refreshToken);
  console.log(accessTokenRes.token);

  const [status, error] = await addGoogleConnection(uid, refreshToken);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status: true });
}

const verifyAsync = async (token: string) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, env.JWT_CONNECTIONS_SECRET, (err, decoded) => {
      if (err) return reject(err);
      return resolve(decoded);
    });
  });
