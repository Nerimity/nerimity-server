import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '@src/middleware/rateLimit';
import { generateError } from '@src/common/errorHandler';
import { unauthorizeApplication } from '@src/services/Oauth2';

export function oauth2Unauthorize(Router: Router) {
  Router.delete(
    '/oauth2/applications/:appId',
    authenticate(),

    rateLimit({
      name: 'oauth2-unauthorize',
      restrictMS: 60000,
      requests: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  if (!req.params.appId) return res.status(400).json(generateError('Missing application id!'));

  const [result, error] = await unauthorizeApplication(req.userCache.id, req.params.appId);
  if (error) return res.status(500).json(error);

  return res.status(200).json({ status: result });
}
