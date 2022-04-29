import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { MessageType } from '../../models/MessageModel';
import { createMessage } from '../../services/Message';

export function channelMessageCreate(Router: Router) {
  Router.post('/channels/:channelId/messages', 
    authenticate(),
    channelVerification(),
    route
  );
}


interface Body {
  content: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;
  
  const message = await createMessage({
    channelId: req.channelCache._id,
    content : body.content,
    userId: req.accountCache.user._id,
    serverId: req.channelCache.server?._id,
    type: MessageType.CONTENT
  });

  res.json(message);
}