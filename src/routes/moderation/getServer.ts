import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { isExpired } from '../../services/User/User';

export function getServer(Router: Router) {
  Router.get('/moderation/servers/:serverId', authenticate(), isModMiddleware, route);
}

async function route(req: Request, res: Response) {
  const serverId = req.params.serverId;

  const server = await prisma.server.findFirst({
    where: { id: serverId },
    select: {
      _count: { select: { serverMembers: true } },
      banner: true,
      name: true,
      verified: true,
      hexColor: true,
      id: true,
      scheduledForDeletion: true,
      createdAt: true,
      publicServer: { select: { id: true, pinnedAt: true } },
      createdBy: {
        select: {
          id: true,
          username: true,
          joinedAt: true,
          tag: true,
          hexColor: true,
          avatar: true,
          suspension: true,
          shadowBan: true,
          badges: true,
        },
      },
      avatar: true,
    },
  });

  if (server?.createdBy.suspension?.expireAt && isExpired(server.createdBy.suspension.expireAt)) {
    server.createdBy.suspension = null;
  }

  res.json(server);
}
