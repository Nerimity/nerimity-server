import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getChannelNotice } from '../../services/Channel';

export function userChannelNoticeGet(Router: Router) {
  Router.get('/users/channel-notice',
    authenticate(),
    rateLimit({
      name: 'user_channel_notice_get',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}




async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const [notice, error] = await getChannelNotice({ userId: req.accountCache.user.id });
  if (error) {
    return res.status(400).json(error);
  }

  res.json({ notice });
}
