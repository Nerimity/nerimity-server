import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { fetchPosts } from '../../services/Post';


export function postsGetComments(Router: Router) {
  Router.get('/posts/:postId/comments', 
    authenticate(),
    rateLimit({
      name: 'post_get_comments',
      expireMS: 20000,
      requestCount: 100,
    }),
    param('postId')
      .isString().withMessage('postId must be a string!')
      .isLength({ min: 1, max: 100 }).withMessage('postId length must be between 1 and 100 characters.'),
    route
  );
  
  Router.get('/posts', 
    authenticate(),
    route
  );
}


interface Param {
  postId: string;
}

async function route (req: Request, res: Response) {
  const params = req.params as unknown as Param;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const commentPosts = await fetchPosts({
    postId: params.postId,
    requesterUserId: req.accountCache.user.id
  });

  res.json(commentPosts);
}