import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchPosts } from '../../services/Post';


export function postsGet(Router: Router) {
  Router.get('/users/:userId/posts', 
    authenticate(),
    rateLimit({
      name: 'post_get',
      expireMS: 20000,
      requestCount: 100,
    }),
    param('userId')
      .isString().withMessage('userId must be a string!')
      .isLength({ min: 1, max: 100 }).withMessage('userId length must be between 1 and 100 characters.')
      .optional(true),
    route
  );
  
  Router.get('/posts', 
    authenticate(),
    route
  );
}


interface Param {
  userId?: string;
}

async function route (req: Request, res: Response) {
  const params = req.params as Param;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const posts = await fetchPosts({
    userId: params.userId || req.accountCache.user.id,
    requesterUserId: req.accountCache.user.id
  });

  res.json(posts);
}