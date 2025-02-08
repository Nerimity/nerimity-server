import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { searchUsers } from '../../services/User/User';

export function userSearch(Router: Router) {
  Router.get(
    '/users/search',
    authenticate(),
    rateLimit({
      name: 'user_search',
      restrictMS: 60000,
      requests: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const result = await searchUsers(req.userCache.id, req.query.q as string);

  res.json(result);
}
