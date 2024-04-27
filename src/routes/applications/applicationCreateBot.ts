import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { createBot } from '../../services/Application';
import { generateError } from '../../common/errorHandler';

export function applicationsCreateBot(Router: Router) {
  Router.post(
    '/applications/:id/bot',
    authenticate(),
    rateLimit({
      name: 'create-bot',
      restrictMS: 60000,
      requests: 2,
      useIP: true,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json(generateError('Missing application id!'));
  }

  const [botUser, error] = await createBot(id, req.userCache.account.id);

  if (error) {
    return res.status(400).json(error);
  }

  res.json(botUser);
}
