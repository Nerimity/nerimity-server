import { Request, Response, Router } from 'express';
import { dateToDateTime, prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getStats(Router: Router) {
  Router.get('/moderation/stats', authenticate(), isModMiddleware, route);
}

async function route(req: Request, res: Response) {
  const [
    totalRegisteredUsers,
    weeklyRegisteredUsers,
    totalCreatedServers,
    totalCreatedMessages,
    weeklyCreatedMessages,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({
      where: {
        joinedAt: {
          gte: dateToDateTime(getLastWeeksDate()),
        },
      },
    }),
    prisma.server.count(),
    prisma.message.count(),
    prisma.message.count({
      where: {
        createdAt: {
          gte: dateToDateTime(getLastWeeksDate()),
        },
      },
    }),
  ]);

  res.json({
    totalRegisteredUsers,
    weeklyRegisteredUsers,
    totalCreatedServers,
    totalCreatedMessages,
    weeklyCreatedMessages,
  });
}

function getLastWeeksDate() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
}
