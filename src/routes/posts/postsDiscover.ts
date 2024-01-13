import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchPosts } from '../../services/Post';

export function postsDiscover(Router: Router) {
  Router.get(
    '/posts/discover',
    authenticate(),
    rateLimit({
      name: 'posts_discover',
      expireMS: 20000,
      requestCount: 20,
    }),
    route
  );
}

interface Query {
  limit?: string;
  afterId?: string;
  beforeId?: string;
}

async function route(req: Request, res: Response) {
  const query = req.query as Query;
  const posts = await fetchPosts({
    withReplies: false,
    requesterUserId: req.accountCache.user.id,
    limit: query.limit ? parseInt(query.limit) : undefined,
    afterId: query.afterId,
    beforeId: query.beforeId,
  });
  res.json(posts);
}
