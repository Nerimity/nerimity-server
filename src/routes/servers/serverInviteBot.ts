import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { getApplicationBot } from '../../services/Application';
import { joinServer } from '../../services/Server';
import { generateError } from '../../common/errorHandler';

export function serverInviteBotJoin(Router: Router) {
  Router.post(
    '/servers/:serverId/invites/applications/:appId/bot',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),

    rateLimit({
      name: 'server_invite_bot',
      restrictMS: 60000,
      requests: 3,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const { serverId, appId } = req.params;
  const { permissions } = req.query;

  if (!serverId || !appId) {
    return res.status(400).json(generateError('Missing serverId or appId'));
  }

  const [botUser, error] = await getApplicationBot(appId);

  if (error) {
    return res.status(400).json(error);
  }

  const perms = parseInt((permissions || '0') as string) || 0;

  const [, joinError] = await joinServer(botUser.id, serverId, {
    botName: botUser.username,
    permissions: perms,
  });

  if (joinError) {
    return res.status(400).json(joinError);
  }

  res.json({ success: true });
}
