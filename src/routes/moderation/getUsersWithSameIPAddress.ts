import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { isExpired } from '../../services/User/User';

export function getUsersWithSameIPAddress(Router: Router) {
  Router.get(
    '/moderation/users/:userId/users-with-same-ip',
    authenticate(),
    isModMiddleware,
    route
  );
}

async function route(req: Request, res: Response) {
  const userId = req.params.userId;
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '30') as string);

  if (limit > 30) {
    limit = 30;
  }

  const userDevices = await prisma.userDevice.findMany({
    where: { userId },
    select: {
      ipAddress: true,
    },
  });
  const userIpAddresses = userDevices.map((device) => device.ipAddress);

  let users = await prisma.user.findMany({
    where: {
      devices: {
        some: { ipAddress: { in: userIpAddresses }, NOT: { userId } },
      },
    },
    orderBy: {
      joinedAt: 'desc',
    },
    ...(after ? { skip: 1 } : undefined),
    take: limit,
    ...(after ? { cursor: { id: after } } : undefined),
    select: {
      id: true,
      username: true,
      joinedAt: true,
      tag: true,
      hexColor: true,
      avatar: true,
      suspension: true,
    },
  });

  users = users.map((user) => {
    if (user.suspension?.expireAt && isExpired(user.suspension.expireAt)) {
      user.suspension = null;
    }
    return user;
  });

  res.json(users);
}
