import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getFeed } from '../../services/Post';


export function postsFeed(Router: Router) {
  Router.get('/posts/feed', 
    authenticate(),
    rateLimit({
      name: 'post_feed',
      expireMS: 20000,
      requestCount: 20,
    }),
    route
  );
}


async function route (req: Request, res: Response) {
  const posts = await getFeed(req.accountCache.user.id);

  res.json(posts);
}