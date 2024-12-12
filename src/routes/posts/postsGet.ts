import { Request, Response, Router } from 'express';
import { param, query } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchPosts } from '../../services/Post';
import { isUserAdmin } from '../../common/Bitwise';

export function postsGet(Router: Router) {
  Router.get(
    '/users/:userId/posts',
    authenticate({ allowNoToken: true }),
    rateLimit({
      name: 'post_get',
      restrictMS: 20000,
      requests: 100,
    }),
    param('userId').isString().withMessage('userId must be a string!').isLength({ min: 1, max: 100 }).withMessage('userId length must be between 1 and 100 characters.').optional(true),
    query('withReplies').isBoolean().withMessage('withReplies must be a boolean!').optional(true),
    route
  );

  Router.get('/posts', authenticate(), route);
}

interface Param {
  userId?: string;
  withReplies?: boolean;
}
interface Query {
  withReplies?: boolean;

  limit?: string;
  afterId?: string;
  beforeId?: string;
}

async function route(req: Request, res: Response) {
  const params = req.params as Param;
  const query = req.query as Query;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const isAdmin = isUserAdmin(req.userCache?.badges);

  let limit = query.limit ? parseInt(query.limit) : undefined;

  if (limit && limit < 0) {
    limit = undefined;
  }

  const posts = await fetchPosts({
    userId: params.userId || req.userCache?.id,
    requesterUserId: req.userCache?.id || '123',
    withReplies: query.withReplies,
    requesterIpAddress: req.userIP,
    bypassBlocked: isAdmin,

    limit,
    afterId: query.afterId,
    beforeId: query.beforeId,
    hidePins: true,
  });

  res.json(posts);
}
