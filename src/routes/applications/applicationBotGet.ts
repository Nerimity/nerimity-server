import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getApplicationBot } from '../../services/Application';
import { prisma } from '../../common/database';
import { ROLE_PERMISSIONS, addBit, hasBit } from '../../common/Bitwise';

export function applicationBotGet(Router: Router) {
  Router.get(
    '/applications/:id/bot',
    authenticate(),
    rateLimit({
      name: 'get-bot',
      expireMS: 60000,
      requestCount: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const appId = req.params.id;
  const includeServers = req.query.includeServers;

  if (!appId) {
    return res.status(400).json({ error: 'Missing application id!' });
  }

  const [bot, error] = await getApplicationBot(appId, { includeCreator: true });

  if (error) {
    return res.status(400).json(error);
  }

  if (!includeServers) {
    return res.json({ bot });
  }
  const serverMembers = await prisma.serverMember.findMany({
    where: {
      userId: req.userCache.id,
    },
    select: {
      roleIds: true,
      server: {
        select: {
          createdById: true,
          roles: true,
          defaultRoleId: true,
          id: true,
          name: true,
        },
      },
    },
  });

  const serverMembersWithPerm = serverMembers.filter((serverMember) => {
    const server = serverMember.server;
    const isCreator = server.createdById === req.userCache.id;
    if (isCreator) return true;

    const roles = serverMember.roleIds.map((id) =>
      server.roles.find((role) => role.id === id)
    );
    const defaultRole = server.roles.find(
      (role) => role.id === server.defaultRoleId
    );
    roles.push(defaultRole);

    let permissions = 0;
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      if (!role) continue;
      permissions = addBit(permissions, role.permissions);
    }
    return hasBit(permissions, ROLE_PERMISSIONS.ADMIN.bit);
  });
  const serversWithPerm = serverMembersWithPerm.map((sm) => ({
    id: sm.server.id,
    name: sm.server.name,
  }));

  res.json({ bot, servers: serversWithPerm });
}
