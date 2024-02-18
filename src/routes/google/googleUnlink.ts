import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';

import { removeGoogleConnection } from '../../services/UserConnection';
import { authenticate } from '../../middleware/authenticate';

export function googleUnlink(Router: Router) {
  Router.post(
    '/google/unlink-account',
    authenticate(),

    rateLimit({
      name: 'google-unlink-account',
      expireMS: 60000,
      requestCount: 3,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [status, error] = await removeGoogleConnection(req.userCache.id);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
