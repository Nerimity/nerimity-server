import { Request, Response, Router } from 'express';

import { rateLimit } from '@src/middleware/rateLimit';
import { oAuth2Authenticate } from '@src/middleware/oAuth2Authenticate';
import { APPLICATION_SCOPES } from '@src/common/Bitwise';
import { prisma } from '@src/common/database';

export function oauth2CurrentUser(Router: Router) {
  Router.get(
    '/oauth2/users/current/servers',
    oAuth2Authenticate({
      scopes: APPLICATION_SCOPES.USER_SERVERS.bit,
    }),

    rateLimit({
      name: 'oauth2-current-user',
      restrictMS: 60000,
      requests: 20,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const result = await prisma.user.findUnique({
    where: { id: req.oAuth2Grant.user.id },
    select: {
      servers: {
        select: {
          id: true,
          name: true,
          avatar: true,
          banner: true,
          createdById: true,
          createdAt: true,
          hexColor: true,
          verified: true,
          systemChannelId: true,
          defaultRoleId: true,
          publicServer: { select: { id: true } },
        },
      },
    },
  });

  if (!result) {
    return res.status(400).json({ error: 'User not found' });
  }

  const servers = result.servers.map((server) => {
    return {
      ...server,
      publicServer: !!server.publicServer,
    };
  });

  return res.status(200).json(servers);
}
