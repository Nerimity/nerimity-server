import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { regenerateApplicationClientSecret } from '../../services/Application';
import { generateError } from '../../common/errorHandler';

export function applicationClientSecretRefresh(Router: Router) {
  Router.post(
    '/applications/:id/client-secret-refresh',
    authenticate(),
    rateLimit({
      name: 'refresh-app-secret',
      restrictMS: 60000,
      requests: 3,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json(generateError('Missing application id!'));
  }
  if (!req.userCache.account) {
    return res.status(401).json(generateError('Unauthorized!'));
  }

  const [application, error] = await regenerateApplicationClientSecret(req.userCache.account.id, id);

  if (error) {
    return res.status(404).json(error);
  }

  res.json(application);
}
