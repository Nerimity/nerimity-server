import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getApplication } from '../../services/Application';
import { prisma } from '../../common/database';
import { deleteAccount } from '../../services/User/UserManagement';

export function applicationDelete(Router: Router) {
  Router.delete(
    '/applications/:id',
    authenticate(),
    rateLimit({
      name: 'delete-bot',
      expireMS: 60000,
      requestCount: 15,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const appId = req.params.id;

  if (!appId) {
    return res.status(400).json({ error: 'Missing application id!' });
  }

  const [app, error] = await getApplication(req.userCache.account!.id, appId);

  if (error) {
    return res.status(400).json(error);
  }

  if (app.botUserId) {
    const [, deleteAccountError] = await deleteAccount(app.botUserId, true);
    if (deleteAccountError) {
      return res.status(400).json(error);
    }
  }
  await prisma.application.delete({ where: { id: appId } });

  res.json({ status: true });
}
