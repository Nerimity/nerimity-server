import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { deletePost } from '../../services/Post';


export function postDelete(Router: Router) {
  Router.delete('/posts/:postId', 
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

  // check if post is created by me
  const exists = await prisma.post.count({where: {createdById: req.accountCache.user.id, id: params.postId}});

  if (!exists) {
    return res.status(404).json(generateError('The post does not exist or it is not created by you.'));
  }

  const [deleted, error] = await deletePost(params.postId);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({success: deleted});
}