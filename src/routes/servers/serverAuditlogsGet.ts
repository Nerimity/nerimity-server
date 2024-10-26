import { Request, Response, Router } from 'express';
import { ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { getAuditLogs } from '../../services/AuditLog';

export function serverAuditLogsGet(Router: Router) {
  Router.get(
    '/servers/:serverId/audit-logs',
    authenticate({ allowBot: true }),
    serverMemberVerification(),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.ADMIN),

    rateLimit({
      name: 'server_auditLogs_get',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '50') as string);

  if (limit > 50) {
    limit = 50;
  }

  const logs = await getAuditLogs(req.params.serverId!, limit, after);

  res.json({
    auditLogs: logs.auditLogs,
    users: logs.users,
  });
}
