import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getUserNotifications } from '../../services/User/User';

export function userNotifications(Router: Router) {
  Router.get('/users/notifications', authenticate(), route);
}

async function route(req: Request, res: Response) {
  const notifications = await getUserNotifications(req.userCache.id);
  res.json(notifications);
}
