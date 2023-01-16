import { Request, Response, Router } from 'express';
import { param, query } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchLikedPosts, fetchPosts } from '../../services/Post';


export function postsGetLiked(Router: Router) {
  Router.get('/users/:userId/posts/liked', 
    authenticate(),
    rateLimit({
      name: 'post_get_liked',
      expireMS: 20000,
      requestCount: 100,
    }),
    param('userId')
      .isString().withMessage('userId must be a string!')
      .isLength({ min: 1, max: 100 }).withMessage('userId length must be between 1 and 100 characters.'),
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

  const posts = await fetchLikedPosts(params.userId || req.accountCache.user.id, req.accountCache.user.id);

  res.json(posts);
}