import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { unlikePost } from '../../services/Post';

export function postUnlike(Router: Router) {
  Router.post(
    '/posts/:postId/unlike',
    authenticate(),
    rateLimit({
      name: 'post_unlike',
      expireMS: 20000,
      requestCount: 30,
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

async function route(req: Request, res: Response) {
  const params = req.params as unknown as Param;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [updatedPost, error] = await unlikePost(
    req.userCache.id,
    params.postId
  );

  if (error) {
    return res.status(400).json(error);
  }

  res.json(updatedPost);
}
