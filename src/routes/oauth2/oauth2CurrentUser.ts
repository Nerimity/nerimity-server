import { Request, Response, Router } from 'express';

import { rateLimit } from '@src/middleware/rateLimit';
import { oAuth2Authenticate } from '@src/middleware/oAuth2Authenticate';
import { getUserDetails } from '@src/services/User/User';
import { APPLICATION_SCOPES, hasBit } from '@src/common/Bitwise';

export function oauth2CurrentUser(Router: Router) {
  Router.get(
    '/oauth2/users/current',
    oAuth2Authenticate({
      scopes: APPLICATION_SCOPES.USER_INFO.bit,
    }),

    rateLimit({
      name: 'oauth2-current-user',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [result, error] = await getUserDetails('', req.oAuth2Grant.user.id, '', false, false);

  if (error) {
    return res.status(400).json(error);
  }

  if (hasBit(req.oAuth2Grant.scopes, APPLICATION_SCOPES.USER_EMAIL.bit)) {
    return res.status(200).json({
      ...result,
      email: req.oAuth2Grant.user.account.email,
    });
  }

  return res.status(200).json(result);
}
