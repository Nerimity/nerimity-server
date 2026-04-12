import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateUserClan } from '@src/services/User/User';

export function userClanDelete(Router: Router) {
  Router.delete(
    '/users/clans/',
    authenticate(),
    rateLimit({
      name: 'user_clan_update',
      restrictMS: 60000, // 1 minutes
      requests: 8,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const [, error] = await updateUserClan({
    serverId: null,
    userId: req.userCache.id,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status: true });
}
