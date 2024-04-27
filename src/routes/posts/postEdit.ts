import { Request, Response, Router } from 'express';
import { body, param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { createPost, editPost } from '../../services/Post';

export function postEdit(Router: Router) {
  Router.patch(
    '/posts/:postId',
    authenticate(),
    rateLimit({
      name: 'edit_post',
      restrictMS: 20000,
      requests: 5,
    }),
    body('content')
      .isString()
      .withMessage('Content must be a string!')
      .isLength({ min: 1, max: 500 })
      .withMessage('Content length must be between 1 and 500 characters.'),
    route
  );
}

interface Body {
  content: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [post, error] = await editPost({
    content: body.content,
    editById: req.userCache.id,
    postId: req.params.postId,
  });

  if (error) {
    return res.status(403).json(error);
  }

  res.json(post);
}
