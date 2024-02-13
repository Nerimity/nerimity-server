import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchPosts, getPostNotifications } from '../../services/Post';

export function postNotifications(Router: Router) {
  Router.get(
    '/posts/notifications',
    authenticate(),
    rateLimit({
      name: 'post_notifications',
      expireMS: 20000,
      requestCount: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const notifications = await getPostNotifications(req.userCache.id);

  res.json(notifications);
}
