import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { googleOAuth2Client } from '../../middleware/GoogleOAuth2Client';
import { rateLimit } from '../../middleware/rateLimit';
import { body } from 'express-validator';
import { decryptToken } from '../../common/JWT';
import { generateError } from '../../common/errorHandler';
import { authenticateUser } from '../../cache/UserCache';

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

  const [cachedAccount, error] = await authenticateUser(
    body.nerimityToken,
    req.userIP
  );

  if (error !== null) {
    return res.status(401).json(generateError(error.message));
  }

  const client = req.GoogleOAuth2Client!;

  const getTokenRes = await client.getToken(body.code);
  const refreshToken = getTokenRes.tokens.refresh_token;

  if (!refreshToken) {
    return res.status(400).json(generateError('Invalid code.'));
  }

  client.setCredentials({ refresh_token: refreshToken });
}
