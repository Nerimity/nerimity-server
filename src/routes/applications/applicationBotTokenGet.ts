import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getBotToken } from '../../services/Application';
import { generateError } from '../../common/errorHandler';

export function applicationBotTokenGet(Router: Router) {
  Router.get(
    '/applications/:id/token',
    authenticate(),
    rateLimit({
      name: 'get-bot-token',
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

  const [token, error] = await getBotToken(req.userCache.account!.id, id);

  if (error) {
    return res.status(404).json(error);
  }

  res.json({ token });
}
