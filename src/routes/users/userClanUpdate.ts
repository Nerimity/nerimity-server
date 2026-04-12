import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { updateUserClan } from '@src/services/User/User';

export function userClanUpdate(Router: Router) {
  Router.post(
    '/users/clans/:serverId',
    authenticate(),
    rateLimit({
      name: 'user_clan_update',
      restrictMS: 60000, // 1 minute
      requests: 8,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const serverId = req.params.serverId as string;

  const [clan, error] = await updateUserClan({
    serverId,
    userId: req.userCache.id,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ clan });
}
