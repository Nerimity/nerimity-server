import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { pinPost } from '../../services/Post';

export function postPin(Router: Router) {
  Router.post('/posts/:postId/pin', authenticate(), param('postId').isString().withMessage('postId must be a string!').isLength({ min: 1, max: 100 }).withMessage('postId length must be between 1 and 100 characters.'), route);
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

  const [status, error] = await pinPost(params.postId, req.userCache.id).catch((e) => {
    console.error(e);
    return [false, generateError('Something went wrong. Try again later.')];
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ success: status });
}
