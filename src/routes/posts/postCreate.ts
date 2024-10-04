import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { createPost } from '../../services/Post';
import { verifyUpload } from '../../common/nerimityCDN';
import { UserCache } from '../../cache/UserCache';

export function postCreate(Router: Router) {
  Router.post(
    '/posts',
    authenticate(),
    rateLimit({
      name: 'create_post',
      restrictMS: 20000,
      requests: 5,
    }),
    body('content').isString().withMessage('Content must be a string!').isLength({ min: 1, max: 500 }).withMessage('Content length must be between 1 and 500 characters.').optional(true),
    body('postId').isString().withMessage('postId must be a string!').isLength({ min: 1, max: 500 }).withMessage('Content length must be between 1 and 500 characters.').optional(true),

    body('poll.choices').isArray({ min: 0, max: 6 }).withMessage('Poll must be an array with minimum 6 choices').optional(true),
    body('nerimityCdnFileId').optional(true).isString().withMessage('nerimityCdnFileId id must be a string!').isLength({ min: 1, max: 255 }).withMessage('nerimityCdnFileId length must be between 1 and 255 characters.'),

    body('poll.choices.*').isString().withMessage('Poll choices must be an array of strings').isLength({ min: 0, max: 56 }).withMessage('Poll choices length must be between 1 and 50 characters').optional(true),
    route
  );
}

interface Body {
  content: string;
  postId?: string; // Used if you want to reply to a post
  poll?: {
    choices: string[];
  };
  nerimityCdnFileId?: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  if (body.poll) {
    body.poll!.choices = body.poll!.choices.map((choice) => choice.trim()).filter((choice) => choice);
  }

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!req.userCache.application && !req.userCache.account?.emailConfirmed) {
    return res.status(400).json(generateError('You must confirm your email to create posts.'));
  }

  if (!body.content?.trim() && !body.nerimityCdnFileId) {
    return res.status(400).json(generateError('content or attachment is required.'));
  }

  let attachment: { width?: number; height?: number; path: string } | undefined = undefined;

  if (body.nerimityCdnFileId) {
    const [uploadedFile, err] = await verifyUpload({
      fileId: body.nerimityCdnFileId,
      groupId: req.userCache.id,
      type: 'ATTACHMENT',
      imageOnly: true
    });

    if (err) {
      return res.status(403).json(generateError(err));
    }

    attachment = {
      width: uploadedFile!.width,
      height: uploadedFile!.height,
      path: uploadedFile!.path,
    };
  }

  const [post, error] = await createPost({
    content: body.content,
    userId: req.userCache.id,
    commentToId: body.postId,
    attachment,
    poll: body.poll,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(post);
}

const isEmailConfirmed = (user: UserCache) => {
  return user.account?.emailConfirmed;
};
