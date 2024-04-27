import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getApplications } from '../../services/Application';

export function applicationsGet(Router: Router) {
  Router.get(
    '/applications',
    authenticate(),
    rateLimit({
      name: 'get-apps',
      restrictMS: 60000,
      requests: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [applications, error] = await getApplications(
    req.userCache.account!.id
  );

  if (error) {
    return res.status(400).json(error);
  }

  res.json(applications);
}
