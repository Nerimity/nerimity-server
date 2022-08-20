import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { getMessagesByChannelId } from '../../services/Message';

export function channelMessages(Router: Router) {
  Router.get('/channels/:channelId/messages', 
    authenticate(),
    channelVerification(),
    route
  );
}




async function route (req: Request, res: Response) {
  const messages = await getMessagesByChannelId(req.channelCache.id);
  res.json(messages);
}