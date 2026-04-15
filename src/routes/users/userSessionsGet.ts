import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getSessions } from '../../services/User/UserManagement';

export function userSessionsGet(Router: Router) {
  Router.get(
    '/users/sessions',
    authenticate(),
    rateLimit({
      name: 'account_sessions',
      restrictMS: 60000,
      requests: 20,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const result = await getSessions(req.userCache.id);

  res.json(result);
}
