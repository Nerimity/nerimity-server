import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { bumpPublicServer } from '../../services/Explore';

export function exploreServerBump(Router: Router) {
  Router.post('/explore/servers/:serverId/bump', 
    authenticate(),
    route
  );
}

async function route (req: Request, res: Response) {
  const { serverId } = req.params;
  const [server, error] = await bumpPublicServer(serverId);

  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}