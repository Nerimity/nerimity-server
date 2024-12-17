import { Request, Response, Router } from 'express';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { repostPost } from '../../services/Post';

export function postRepost(Router: Router) {
  Router.post(
    '/posts/:postId/repost',
    authenticate(),
    rateLimit({
      name: 'repost_post',
      restrictMS: 20000,
      requests: 5,
    }),

    route
  );
}

async function route(req: Request, res: Response) {
  const repostId = req.params.postId!;

  if (!req.userCache.application && !req.userCache.account?.emailConfirmed) {
    return res.status(400).json(generateError('You must confirm your email to create posts.'));
  }

  const [post, error] = await repostPost({
    userId: req.userCache.id,
    postId: repostId,
  }).catch((err) => {
    console.error(err);
    return [null, generateError('Something went wrong. Try again later.')] as const;
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(post);
}
