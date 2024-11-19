import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getFeed } from '../../services/Post';

export function postsFeed(Router: Router) {
  Router.get(
    '/posts/feed',
    authenticate(),
    rateLimit({
      name: 'post_feed',
      restrictMS: 20000,
      requests: 20,
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

  let limit = query.limit ? parseInt(query.limit) : undefined;

  if (limit && limit < 0) {
    limit = undefined;
  }

  const posts = await getFeed({
    userId: req.userCache.id,
    limit,
    afterId: query.afterId,
    beforeId: query.beforeId,
    requesterIpAddress: req.userIP,
  });

  res.json(posts);
}
