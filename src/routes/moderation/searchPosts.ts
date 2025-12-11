import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { fetchPosts } from '../../services/Post';

export function searchPosts(Router: Router) {
  Router.get('/moderation/posts/search', authenticate(), isModMiddleware({ allowModBadge: true }), route);
}

async function route(req: Request, res: Response) {
  const search = req.query.q as string | undefined;

  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const posts = await fetchPosts({
    where: {
      OR: [{ id: search }, { createdById: search }],
    },
    withReplies: true,
    bypassBlocked: true,
    requesterIpAddress: req.userIP,
    requesterUserId: req.userCache.id,
    limit: limit,
    afterId: after,
    additionalInclude: {
      announcement: { select: { createdAt: true } },
    },
  });

  res.json(posts);
}
