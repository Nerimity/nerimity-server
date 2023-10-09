import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getChannelNotice } from '../../services/Channel';
import { channelVerification } from '../../middleware/channelVerification';

export function channelNoticeGet(Router: Router) {
  Router.get(
    '/channels/:channelId/notice',
    authenticate(),
    channelVerification(),
    rateLimit({
      name: 'channel_notice_get',
      expireMS: 10000,
      requestCount: 20,
    }),
    route
  );
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const recipientId = req.channelCache.inbox?.recipientId;
  const [notice, error] = await getChannelNotice(recipientId ? { userId: recipientId } : { channelId: req.channelCache.id });
  if (error) {
    return res.status(400).json(error);
  }

  res.json({ notice });
}
