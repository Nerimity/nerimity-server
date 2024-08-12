import { Request, Response, Router } from 'express';
import { generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';

import { rateLimit } from '../../middleware/rateLimit';

import { getChannel } from '../../services/Channel';

export function channelGet(Router: Router) {
  Router.get(
    '/channels/:channelId',
    authenticate({ allowBot: true }),
    channelVerification(),

    rateLimit({
      name: 'channel_get',
      restrictMS: 20000,
      requests: 40,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [channel, error] = await getChannel(req.channelCache.id, req.userCache.id);

  if (error) {
    return res.status(400).json(generateError(error.message));
  }

  res.json(channel);
}
