import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { createPost } from '../../services/Post';


export function postCreate(Router: Router) {
  Router.post('/posts', 
    authenticate(),
    rateLimit({
      name: 'create_post',
      expireMS: 20000,
      requestCount: 5,
    }),
    body('content')
      .isString().withMessage('Content must be a string!')
      .isLength({ min: 1, max: 500 }).withMessage('Content length must be between 1 and 500 characters.'),
    route
  );
}


interface Body {
  content: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const post = await createPost({
    content: body.content,
    userId: req.accountCache.user.id
  });


  res.json(post);
}