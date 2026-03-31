import { Request, Response, Router } from 'express';
import { rateLimit } from '../../../middleware/rateLimit';

import { removeGoogleDriveConnection as removeGoogleDriveConnection } from '../../../services/UserConnection';
import { authenticate } from '../../../middleware/authenticate';

export function googleDriveUnlink(Router: Router) {
  Router.post(
    '/connections/google-drive/unlink-account',
    authenticate(),

    rateLimit({
      name: 'google-d-unlink-account',
      restrictMS: 60000,
      requests: 3,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const [status, error] = await removeGoogleDriveConnection(req.userCache.id);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
