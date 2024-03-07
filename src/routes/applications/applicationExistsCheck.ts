import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { applicationExists } from '../../services/Application';
import { generateError } from '../../common/errorHandler';

export function applicationExistsCheck(Router: Router) {
  Router.get(
    '/applications/:id/exists',
    authenticate(),
    rateLimit({
      name: 'app-exists',
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

  const [exists, error] = await applicationExists(id);

  if (error) {
    return res.status(404).json(error);
  }

  res.json({ exists });
}
