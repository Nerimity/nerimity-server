import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { fetchPosts, likePost } from '../../services/Post';


export function postLike(Router: Router) {
  Router.post('/posts/:postId/like', 
    authenticate(),
    param('postId')
      .isString().withMessage('postId must be a string!')
      .isLength({ min: 1, max: 100 }).withMessage('postId length must be between 1 and 100 characters.'),
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

  const [updatedPost, error] = await likePost(req.accountCache.user.id, params.postId);

  if (error) {
    return res.status(400).json(error);
  }

  res.json(updatedPost);
}