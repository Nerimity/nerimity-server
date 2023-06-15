import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getMessagesByChannelId } from '../../services/Message';
import { generateError } from '../../common/errorHandler';
import { ChannelType } from '../../types/Channel';

export function channelMessages(Router: Router) {
  Router.get(
    '/channels/:channelId/messages',
    authenticate(),
    channelVerification(),
    rateLimit({
      name: 'messages',
      expireMS: 30000,
      requestCount: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const limit = parseInt((req.query.limit as string) || '50') || undefined;
  const after = (req.query.after as string) || undefined;
  const before = (req.query.before as string) || undefined;
  const around = (req.query.around as string) || undefined;

  if (req.channelCache.type === ChannelType.CATEGORY) {
    return res
      .status(400)
      .json(generateError('Cannot get messages from a category channel'));
  }

  const messages = await getMessagesByChannelId(req.channelCache.id, {
    limit,
    afterMessageId: after,
    beforeMessageId: before,
    aroundMessageId: around,
    requesterId: req.accountCache.user.id,
  });
  res.json(messages);
}
