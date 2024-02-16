import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { refreshBotToken } from '../../services/Application';
import { generateError } from '../../common/errorHandler';

export function applicationBotTokenRefresh(Router: Router) {
  Router.post(
    '/applications/:id/token',
    authenticate(),
    rateLimit({
      name: 'refresh-bot-token',
      expireMS: 60000,
      requestCount: 5,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json(generateError('Missing application id!'));
  }

  const [status, error] = await refreshBotToken(req.userCache.account!.id, id);

  if (error) {
    return res.status(404).json(error);
  }

  res.json({ status });
}
