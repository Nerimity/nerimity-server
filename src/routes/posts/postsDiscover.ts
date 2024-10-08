import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchPosts } from '../../services/Post';
import { isUserAdmin } from '../../common/Bitwise';

export function postsDiscover(Router: Router) {
  Router.get(
    '/posts/discover',
    authenticate(),
    rateLimit({
      name: 'posts_discover',
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

  const isAdmin = isUserAdmin(req.userCache.badges);

  let limit = query.limit ? parseInt(query.limit) : undefined;

  if (limit && limit < 0) {
    limit = undefined;
  }

  const posts = await fetchPosts({
    hideIfBlockedByMe: true,
    withReplies: false,
    bypassBlocked: isAdmin,
    requesterUserId: req.userCache.id,
    limit,
    afterId: query.afterId,
    beforeId: query.beforeId,
  });
  res.json(posts);
}
