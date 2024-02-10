import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getApplication } from '../../services/Application';
import { generateError } from '../../common/errorHandler';

export function applicationGet(Router: Router) {
  Router.get(
    '/applications/:id',
    authenticate(),
    rateLimit({
      name: 'get-app',
      expireMS: 60000,
      requestCount: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json(generateError('Missing application id!'));
  }

  const [application, error] = await getApplication(req.accountCache.id, id);

  if (error) {
    return res.status(404).json(error);
  }

  res.json(application);
}
