import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { createExternalEmbed, ExternalEmbedType } from '../../services/User/UserManagement';
import { generateError } from '../../common/errorHandler';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';

export function serverExternalEmbedCreate(Router: Router) {
  Router.post(
    '/servers/:serverId/external-embed',
    authenticate(),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),
    rateLimit({
      name: 'external_embed',
      restrictMS: 60000,
      requests: 4,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const inviteId = req.query.inviteId as string;

  const [result, error] = await createExternalEmbed({
    serverId: req.serverCache.id,
    type: ExternalEmbedType.SERVER,
    serverInviteId: inviteId,
  }).catch((err) => {
    console.error(err);
    return [null, generateError('Something went wrong. Try again later.')] as const;
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ id: result.id });
}
