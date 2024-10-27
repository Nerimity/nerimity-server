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
  sort?: string;
}

const SortOptions = ['mostLiked7Days', 'mostLiked30days', 'mostLikedAllTime'];
async function route(req: Request, res: Response) {
  const query = req.query as Query;

  const isAdmin = isUserAdmin(req.userCache.badges);

  let limit = query.limit ? parseInt(query.limit) : undefined;

  if (limit && limit < 0) {
    limit = undefined;
  }

  const sort = SortOptions.includes(query.sort!) ? query.sort : undefined;

  let afterDate: Date | undefined = undefined;

  if (sort) {
    if (sort === 'mostLiked30days') {
      afterDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    if (sort === 'mostLiked7Days') {
      afterDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  const posts = await fetchPosts({
    doNotReverse: !!sort,
    hideIfBlockedByMe: true,
    withReplies: false,
    bypassBlocked: isAdmin,
    requesterUserId: req.userCache.id,
    limit,
    afterId: query.afterId,
    beforeId: query.beforeId,

    ...(sort
      ? {
          orderBy: {
            estimateLikes: 'desc',
          },
          ...(afterDate
            ? {
                where: {
                  createdAt: {
                    gte: afterDate,
                  },
                },
              }
            : {}),
        }
      : {}),
  });
  res.json(posts);
}
