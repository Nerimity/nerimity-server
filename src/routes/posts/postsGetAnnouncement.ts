import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getAnnouncementPosts } from '../../services/Post';

export function postsGetAnnouncement(Router: Router) {
  Router.get(
    '/posts/announcement',
    authenticate(),
    rateLimit({
      name: 'post_announcement',
      restrictMS: 20000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const posts = await getAnnouncementPosts(req.userCache.id, req.userIP);

  res.json(posts);
}
