import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getPostReposts } from '../../services/Post';

export function postGetReposts(Router: Router) {
  Router.get(
    '/posts/:postId/reposts',
    authenticate(),
    rateLimit({
      name: 'post_get_reposts',
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

async function route(req: Request, res: Response) {
  const params = req.params as unknown as Param;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [reposts, error] = await getPostReposts(params.postId);

  if (error) {
    return res.status(403).json(error);
  }

  res.json(reposts);
}
