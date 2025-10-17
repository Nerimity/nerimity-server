import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { pinnedChannelMessages } from '../../services/Message/Message';
import { rateLimit } from '@src/middleware/rateLimit';

export function channelMessagePinsGet(Router: Router) {
  Router.get(
    '/channels/:channelId/messages/pins',
    authenticate({ allowBot: false }),
    channelVerification(),
    rateLimit({
      name: 'pin_get',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const afterId = req.query.afterId as string | undefined;

  const [messages, error] = await pinnedChannelMessages(req.channelCache.id, afterId);
  if (error) return res.status(500).json(error);

  return res.status(200).json({ messages });
}
