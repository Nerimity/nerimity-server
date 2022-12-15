import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { joinPublicServer } from '../../services/Explore';

export function exploreServerJoin(Router: Router) {
  Router.post('/explore/servers/:serverId/join', 
    authenticate(),
    route
  );
}

async function route (req: Request, res: Response) {
  const { serverId } = req.params;
  const [server, error] = await joinPublicServer(req.accountCache.user.id, serverId);
  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}