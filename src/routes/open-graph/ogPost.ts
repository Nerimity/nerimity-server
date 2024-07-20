import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { makeOpenGraph } from './makeOpenGraph';
import env from '../../common/env';

export function ogPost(Router: Router) {
  Router.get('/og/*', route);
}

async function route(req: Request, res: Response, next: NextFunction) {
  const query = req.query;
  if (typeof query.postId !== 'string') return next();

  const postId = query.postId;

  const post = await prisma.post.findUnique({
    where: {
      id: postId,
      deleted: null,
    },
    select: {
      content: true,
      attachments: {
        select: {
          path: true,
          width: true,
          height: true,
        },
      },
      createdBy: { select: { username: true } },
    },
  });
  if (!post) return next();

  const attachment = post.attachments[0];
  const attachmentPath = attachment?.path;

  const og = makeOpenGraph({
    url: `https://nerimity.com/app?postId=${postId}`,
    title: `${post.createdBy.username} on Nerimity`,
    description: post.content || '',
    largeImage: true,
    imageUrl: attachmentPath ? `${env.NERIMITY_CDN}${attachmentPath}` : undefined,
    imageWidth: attachment?.width,
    imageHeight: attachment?.height,
  });

  res.send(og);
}
