import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { followingUsers } from '../../services/User';

export function userFollowing(Router: Router) {
  Router.get('/users/:userId?/following',
    authenticate(),
    rateLimit({
      name: 'user_following',
      expireMS: 60000,
      requestCount: 20,
    }),
    route
  );
}

interface Params {
  userId?: string;
}

async function route (req: Request, res: Response) {
  const params = req.params as unknown as Params;

  const [following, error] = await followingUsers(params.userId || req.accountCache.user.id);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(following);   
  
}