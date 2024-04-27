import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import {
  dismissPostNotification,
  fetchPosts,
  getPostNotificationCount,
  getPostNotifications,
} from '../../services/Post';

export function postNotificationDismiss(Router: Router) {
  Router.post(
    '/posts/notifications/dismiss',
    authenticate(),
    rateLimit({
      name: 'post_notification_dismiss',
      restrictMS: 20000,
      requests: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  await dismissPostNotification(req.userCache.id);
  res.end();
}
