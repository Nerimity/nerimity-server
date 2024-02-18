import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchPosts } from '../../services/Post';
import { isUserAdmin } from '../../common/Bitwise';

export function postsGetComments(Router: Router) {
  Router.get(
    '/posts/:postId/comments',
    authenticate(),
    rateLimit({
      name: 'post_get_comments',
      expireMS: 20000,
      requestCount: 100,
    }),
    param('postId')
      .isString()
      .withMessage('postId must be a string!')
      .isLength({ min: 1, max: 100 })
      .withMessage('postId length must be between 1 and 100 characters.'),
    route
  );
}

interface Param {
  postId: string;
}

interface Query {
  limit?: string;
  afterId?: string;
  beforeId?: string;
}

async function route(req: Request, res: Response) {
  const params = req.params as unknown as Param;

  const query = req.query as unknown as Query;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const isAdmin = isUserAdmin(req.userCache.badges);

  const commentPosts = await fetchPosts({
    postId: params.postId,
    requesterUserId: req.userCache.id,
    bypassBlocked: isAdmin,
    limit: query.limit ? parseInt(query.limit) : undefined,
    afterId: query.afterId,
    beforeId: query.beforeId,
  });

  res.json(commentPosts);
}
