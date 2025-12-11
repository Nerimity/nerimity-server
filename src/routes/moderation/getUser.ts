import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { isExpired } from '../../services/User/User';

export function getUser(Router: Router) {
  Router.get('/moderation/users/:userId', authenticate(), isModMiddleware({ allowModBadge: true }), route);
}

async function route(req: Request, res: Response) {
  const userId = req.params.userId;

  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      suspension: {
        include: {
          suspendBy: true,
        },
      },
      profile: true,
      devices: { orderBy: { createdAt: 'desc' }, omit: { ipAddress: !req.hasAdminOrCreatorBadge } },
      servers: {
        select: {
          scheduledForDeletion: true,
          publicServer: { select: { id: true } },
          verified: true,
          name: true,
          hexColor: true,
          id: true,
          createdAt: true,
          createdBy: { select: { id: true, username: true, tag: true } },
          avatar: true,
        },
      },
      application: {
        include: {
          creatorAccount: {
            select: {
              user: {
                select: {
                  id: true,
                  username: true,
                  joinedAt: true,
                  tag: true,
                  hexColor: true,
                  avatar: true,
                  suspension: true,
                  badges: true,
                },
              },
            },
          },
        },
      },
      shadowBan: true,
      account: {
        select: {
          suspendCount: true,
          warnExpiresAt: true,
          warnCount: true,
          email: req.hasAdminOrCreatorBadge,
          emailConfirmCode: req.hasAdminOrCreatorBadge,
          emailConfirmed: true,
        },
      },
    },
  });

  if (!user) return null;

  if (user.suspension?.expireAt && isExpired(user.suspension.expireAt)) {
    user.suspension = null;
  }

  const applicationUser = user.application?.creatorAccount.user;

  if (applicationUser && applicationUser.suspension?.expireAt && isExpired(applicationUser.suspension.expireAt)) {
    applicationUser.suspension = null;
  }

  res.json(user);
}
