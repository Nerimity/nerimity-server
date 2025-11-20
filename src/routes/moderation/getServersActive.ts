import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { getHourStart } from '@src/common/utils';

export function getServersActive(Router: Router) {
  Router.get('/moderation/servers/active', authenticate(), isModMiddleware, route);
}

async function route(req: Request, res: Response) {
  const activeServersLastWeek = await getTopActiveServers(7);

  res.json(activeServersLastWeek);
}

async function getTopActiveServers(daysToLookBack: number) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToLookBack);
    const queryStart = getHourStart(startDate);

    const results = await prisma.serverHourlyMessageCount.groupBy({
      by: ['serverId'],
      take: 20,
      _sum: {
        messageCount: true,
      },
      where: {
        hourStart: {
          gte: queryStart,
        },
      },
      orderBy: {
        _sum: {
          messageCount: 'desc',
        },
      },
    });

    const serverIds = results.map((r) => r.serverId);

    const servers = await prisma.server.findMany({
      where: {
        id: {
          in: serverIds,
        },
      },
      select: {
        scheduledForDeletion: true,
        name: true,
        hexColor: true,
        id: true,
        createdAt: true,
        createdBy: {
          select: { id: true, username: true, tag: true, badges: true },
        },
        avatar: true,
      },
    });

    return servers.map((s) => ({ ...s, messageCount: results.find((r) => r.serverId === s.id)?._sum.messageCount || 0 })).sort((a, b) => b.messageCount - a.messageCount);
  } catch {
    return [];
  }
}
