import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { buttonClick } from '../../services/Message/Message';

export function channelMessageButtonClick(Router: Router) {
  Router.post(
    '/channels/:channelId/messages/:messageId/buttons/:buttonId',
    authenticate(),
    channelVerification(),
    rateLimit({
      name: 'button_click',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

interface RequestParams {
  channelId: string;
  messageId: string;
  buttonId: string;
}

async function route(req: Request, res: Response) {
  const { channelId, messageId, buttonId } = req.params as unknown as RequestParams;

  const [status, error] = await buttonClick({
    channelId,
    messageId,
    buttonId,
    clickedUserId: req.userCache.id,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
