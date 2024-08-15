import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { deleteApplication } from '../../services/Application';

export function applicationDelete(Router: Router) {
  Router.delete(
    '/applications/:id',
    authenticate(),
    rateLimit({
      name: 'delete-bot',
      restrictMS: 60000,
      requests: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const appId = req.params.id;

  const [status, error] = await deleteApplication(req.userCache.account!.id, appId!);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status: status });
}
