import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { fetchPosts } from '../../services/Post';

export function getPosts(Router: Router) {
  Router.get('/moderation/posts', authenticate(), isModMiddleware({ allowModBadge: true }), route);
}

async function route(req: Request, res: Response) {
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const posts = await fetchPosts({
    withReplies: true,
    bypassBlocked: true,
    requesterUserId: req.userCache.id,
    limit: limit,
    requesterIpAddress: req.userIP,
    afterId: after,
    additionalInclude: {
      announcement: { select: { createdAt: true } },
    },
  });

  res.json(posts);
}
