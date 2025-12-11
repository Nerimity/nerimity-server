import { Request, Response, Router } from 'express';
import { dateToDateTime, prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';

export function getStats(Router: Router) {
  Router.get('/moderation/stats', authenticate(), isModMiddleware({ allowModBadge: true }), route);
}

async function route(req: Request, res: Response) {
  const firstDayOfWeek = getFirstDayOfWeek();

  const [totalRegisteredUsers, weeklyRegisteredUsers, totalCreatedServers, totalCreatedMessages, weeklyCreatedMessages] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({
      where: {
        joinedAt: {
          gte: dateToDateTime(firstDayOfWeek),
        },
      },
    }),
    prisma.server.count(),
    prisma.message.count(),
    prisma.message.count({
      where: {
        createdAt: {
          gte: dateToDateTime(firstDayOfWeek),
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

// Get the first day of the current week (Monday)
function getFirstDayOfWeek() {
  const date = new Date();
  const day = date.getDay();

  const diff = date.getDate() - day + (day === 0 ? -6 : 1);

  date.setDate(diff);

  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  return date;
}
