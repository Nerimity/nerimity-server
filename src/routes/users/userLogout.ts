import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { decryptToken } from '@src/common/JWT';
import { logout } from '@src/services/User/UserManagement';

export function userLogout(Router: Router) {
  Router.delete(
    '/users/logout',
    authenticate({}),
    rateLimit({
      name: 'user_logout',
      restrictMS: 10000,
      requests: 10,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const token = req.header('Authorization');

  const decryptedToken = decryptToken(token!);
  if (!decryptedToken) {
    return res.status(401).json({ message: 'Invalid token.' });
  }

  const sessionId = decryptedToken.userId;

  await logout(req.userCache.id, sessionId);

  res.json({ status: true });
}
