import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../common/database';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { AuditLogType } from '../../common/ModAuditLog';
import { checkUserPassword } from '../../services/UserAuthentication';
import { deleteFile } from '../../common/nerimityCDN';

export function postBatchSuspend(Router: Router) {
  Router.post(
    '/moderation/posts/delete',
    authenticate(),
    isModMiddleware,
    body('postIds').not().isEmpty().withMessage('postIds is required').isArray().withMessage('postIds must be an array.'),

    body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').isString().withMessage('Password must be a string!').not().isEmpty().withMessage('Password is required'),
    route
  );
}

interface Body {
  postIds: string[];
  password: string;
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const account = await prisma.account.findFirst({
    where: { id: req.userCache.account?.id },
    select: { password: true },
  });
  if (!account) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(account.password, req.body.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));

  if (req.body.postIds.length >= 5000) return res.status(403).json(generateError('post ids must contain less than 5000 ids.'));

  const sanitizedPostIds = removeDuplicates(req.body.postIds) as string[];

  const posts = await prisma.post.findMany({
    where: { id: { in: sanitizedPostIds }, deleted: null },
    select: { id: true, createdBy: { select: { id: true, username: true } }, attachments: { select: { path: true } } },
  });
  const validPostIds = posts.map((post) => post.id);
  if (!validPostIds.length) {
    return res.status(200).json({ success: true });
  }

  await prisma.$transaction([
    prisma.post.updateMany({
      where: { id: { in: validPostIds } },
      data: {
        content: null,
        deleted: true,
      },
    }),
    prisma.postLike.deleteMany({ where: { postId: { in: validPostIds } } }),
    prisma.attachment.deleteMany({ where: { postId: { in: validPostIds } } }),
    prisma.postPoll.deleteMany({ where: { postId: { in: validPostIds } } }),
    prisma.announcementPost.deleteMany({ where: { postId: { in: validPostIds } } }),
  ]);

  await prisma.modAuditLog.createMany({
    data: posts.map((post) => ({
      id: generateId(),
      actionType: AuditLogType.postDelete,
      actionById: req.userCache.id,

      username: post.createdBy.username,
      userId: post.createdBy.id,
    })),
  });

  res.status(200).json({ success: true });

  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    if (!post?.attachments[0]) continue;
    const attachment = post.attachments[0];
    if (!attachment.path) continue;
    await deleteFile(attachment.path).catch(() => {});
  }
}
