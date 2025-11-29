import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '@src/middleware/rateLimit';
import { getAppAuthorizations } from '@src/services/Oauth2';

export function oauth2AuthorizedApps(Router: Router) {
  Router.get(
    '/oauth2/applications',
    authenticate(),

    rateLimit({
      name: 'oauth2-authorized',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [result, error] = await getAppAuthorizations(req.userCache.id);
  if (error) return res.status(500).json(error);

  return res.status(200).json(result);
}
