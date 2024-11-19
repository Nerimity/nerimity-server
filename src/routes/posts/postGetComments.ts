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
    authenticate({
      allowNoToken: true,
    }),
    rateLimit({
      name: 'post_get_comments',
      restrictMS: 20000,
      requests: 100,
    }),
    param('postId').isString().withMessage('postId must be a string!').isLength({ min: 1, max: 100 }).withMessage('postId length must be between 1 and 100 characters.'),
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

  const isAdmin = req.userCache && isUserAdmin(req.userCache.badges);

  let limit = query.limit ? parseInt(query.limit) : undefined;

  if (limit && limit < 0) {
    limit = undefined;
  }

  const commentPosts = await fetchPosts({
    postId: params.postId,
    requesterUserId: req.userCache?.id || '123',
    requesterIpAddress: req.userIP,
    bypassBlocked: isAdmin,
    limit,
    afterId: query.afterId,
    beforeId: query.beforeId,
  });

  res.json(commentPosts);
}
