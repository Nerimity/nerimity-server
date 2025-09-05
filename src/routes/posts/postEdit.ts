import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { editPost } from '../../services/Post';
import { hasBit, USER_BADGES } from '../../common/Bitwise';

export function postEdit(Router: Router) {
  Router.patch(
    '/posts/:postId',
    authenticate({ allowBot: true }),
    rateLimit({
      name: 'edit_post',
      restrictMS: 20000,
      requests: 5,
    }),
    body('content').isString().withMessage('Content must be a string!'),
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

  const contentLimit = hasBit(req.userCache.badges, USER_BADGES.SUPPORTER.bit) ? 1500 : 500;

  if (body.content?.length > contentLimit) {
    return res.status(400).json(generateError(`Content length must be between 1 and ${contentLimit} characters.`));
  }

  const [post, error] = await editPost({
    content: body.content,
    editById: req.userCache.id,
    postId: req.params.postId!,
  });

  if (error) {
    return res.status(403).json(error);
  }

  res.json(post);
}
