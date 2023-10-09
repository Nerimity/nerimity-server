import { Request, Response, Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { getChannelNotice } from '../../services/Channel';
import { channelVerification } from '../../middleware/channelVerification';

export function serverChannelNoticeGet(Router: Router) {
  Router.get(
    '/servers/:serverId/channels/:channelId/notice',
    authenticate(),
    serverMemberVerification(),
    channelVerification(),
    rateLimit({
      name: 'server_channel_notice_get',
      expireMS: 10000,
      requestCount: 20,
    }),
    route
  );
}

async function route(req: Request<unknown, unknown, Body>, res: Response) {

  const [notice, error] = await getChannelNotice(req.channelCache.id);
  if (error) {
    return res.status(400).json(error);
  }

  res.json({ notice });
}
