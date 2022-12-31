import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getMessagesByChannelId } from '../../services/Message';

export function channelMessages(Router: Router) {
  Router.get('/channels/:channelId/messages', 
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




async function route (req: Request, res: Response) {
  const limit = parseInt(req.query.limit as string || '50') || undefined;
  const after = req.query.after as string || undefined;

  const messages = await getMessagesByChannelId(req.channelCache.id, limit, after);
  res.json(messages);
}