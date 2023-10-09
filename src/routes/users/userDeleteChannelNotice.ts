import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { deleteChannelNotice } from '../../services/Channel';

export function userUpdateChannelNotice(Router: Router) {
  Router.delete('/users/channel-notice',
    authenticate(),
    rateLimit({
      name: 'user_channel_notice_delete',
      expireMS: 10000,
      requestCount: 10,
    }),
    route
  );
}




async function route(req: Request<unknown, unknown, Body>, res: Response) {

  const [status, error] = await deleteChannelNotice({ userId: req.accountCache.user.id });
  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
