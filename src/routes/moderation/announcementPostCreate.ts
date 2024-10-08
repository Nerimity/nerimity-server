import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { checkUserPassword } from '../../services/UserAuthentication';
import { addAnnouncementPost } from '../../services/Post';

export function announcementPostCreate(Router: Router) {
  Router.post(
    '/moderation/posts/:postId/announcement',
    authenticate(),
    isModMiddleware,

    body('password')
      .isLength({ min: 4, max: 72 })
      .withMessage('Password must be between 4 and 72 characters long.')
      .isString()
      .withMessage('Password must be a string!')
      .not()
      .isEmpty()
      .withMessage('Password is required'),
    route
  );
}

interface Body {
  password: string;
}

async function route(req: Request<{ postId: string }, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const account = await prisma.account.findFirst({
    where: { id: req.userCache.account?.id },
    select: { password: true },
  });
  if (!account)
    return res
      .status(404)
      .json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(
    account.password,
    req.body.password
  );
  if (!isPasswordValid)
    return res.status(403).json(generateError('Invalid password.', 'password'));

  const postId = req.params.postId;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  if (!post) {
    return res
      .status(404)
      .json(generateError('Post not found', 'postId'));
  }

  const addRes = await addAnnouncementPost(postId).catch(() => {
    return res
      .status(500)
      .json(generateError('Something went wrong. Try again later.'));
  })
  if (!addRes) return;

  res.json({ success: true });
}

// ## Changes To Terms And Conditions
// Please review these changes in the link below:
// https://nerimity.com/terms-and-conditions
// ### Noteworthy Changes:
// This is a hobby passion project and I reserve the right to suspend anyone for any reason.
// Everyone must make their servers and the content inside it in English.
// links, videos depicting mentions of bodily gore, self harm, disturbing imagery, triggering or illegal topics are absolutely prohibited
// + More