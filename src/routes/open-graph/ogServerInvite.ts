import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { makeOpenGraph } from './makeOpenGraph';
import env from '../../common/env';

export function ogServerInvite(Router: Router) {
  Router.get('/og/i/:inviteId', route);
}

async function route(req: Request, res: Response, next: NextFunction) {
  const inviteId = req.params.inviteId as string;

  const invite = await prisma.serverInvite.findFirst({
    where: {
      code: inviteId,
    },
    select: {
      server: {
        select: {
          name: true,
          avatar: true,
        },
      },
      createdBy: { select: { username: true } },
    },
  });
  if (!invite) return next();

  const avatarPath = invite.server.avatar;

  const og = makeOpenGraph({
    url: `https://nerimity.com/i/${inviteId}`,
    title: `${invite.server.name} server on Nerimity`,
    description: `You are invited to join ${invite.server.name} on Nerimity.`,
    image: avatarPath ? `${env.NERIMITY_CDN}${avatarPath}` : undefined,
  });

  res.send(og);
}
