import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { getAuditLogs } from '../../services/AuditLog';

export function getUsersAuditLog(Router: Router) {
  Router.get('/moderation/users/audit-logs', authenticate(), isModMiddleware(), route);
}

async function route(req: Request, res: Response) {
  const search = req.query.q as string | undefined;

  const after = req.query.after as string | undefined;
  let limit = parseInt((req.query.limit || '50') as string);

  if (limit > 50) {
    limit = 50;
  }

  const serverId = undefined; // No specific server, search across all servers

  const posts = await getAuditLogs(serverId, limit, after, search);

  res.json(posts);
}
