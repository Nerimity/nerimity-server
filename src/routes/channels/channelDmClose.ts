import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { closeDMChannel } from '../../services/User/User';

export function channelDMClose(Router: Router) {
  Router.delete(
    '/channels/:channelId',
    authenticate(),
    channelVerification(),
    rateLimit({
      name: 'channel_dm_close',
      restrictMS: 10000,
      requests: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [, error] = await closeDMChannel(req.userCache.id, req.channelCache.id);
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ status: true });
}
