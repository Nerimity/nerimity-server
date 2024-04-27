import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import {
  fetchPosts,
  getPostNotificationCount,
  getPostNotifications,
} from '../../services/Post';

export function postNotificationCount(Router: Router) {
  Router.get(
    '/posts/notifications/count',
    authenticate(),
    rateLimit({
      name: 'post_notification_count',
      restrictMS: 20000,
      requests: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const count = await getPostNotificationCount(req.userCache.id);
  res.json(count);
}
