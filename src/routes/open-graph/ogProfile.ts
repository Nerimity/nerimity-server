import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { makeOpenGraph } from './makeOpenGraph';
import env from '../../common/env';

export function ogProfile(Router: Router) {
  Router.get('/og/app/profile/:userId', route);
}

async function route(req: Request, res: Response, next: NextFunction) {
  const userId = req.params.userId as string;

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      username: true,
      avatar: true,
      profile: {
        select: { bio: true, primaryColor: true },
      },
    },
  });
  if (!user) return next();

  const avatarPath = user.avatar;

  const og = makeOpenGraph({
    url: `https://nerimity.com/app/profile/${userId}`,
    title: `${user.username}'s Profile on Nerimity`,
    description: `${user.profile?.bio || `Browse ${user.username}'s profile on Nerimity.`}`,
    imageUrl: avatarPath ? `${env.NERIMITY_CDN}${avatarPath}` : undefined,
    color: user.profile?.primaryColor,
  });

  res.send(og);
}
