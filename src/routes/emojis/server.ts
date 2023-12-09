import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getPublicServerFromEmoji } from '../../services/Server';
import { rateLimit } from '../../middleware/rateLimit';

export function emojisGetServer(Router: Router) {
  Router.get(
    '/emojis/:id/server',
    authenticate(),
    rateLimit({
      name: 'get-emoji',
      expireMS: 60000,
      requestCount: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [server, error] = await getPublicServerFromEmoji(req.params.id);

  if (error) {
    return res.status(400).json(error);
  }

  res.json(server);
}
