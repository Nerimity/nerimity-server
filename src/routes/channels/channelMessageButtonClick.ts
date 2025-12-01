import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { buttonClick } from '../../services/Message/Message';
import { generateError } from '@src/common/errorHandler';

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

  if (typeof req.body === 'object') {
    const bodyKeys = Object.keys(req.body);
    if (bodyKeys.length > 0) {
      if (bodyKeys.length > 10) {
        return res.status(400).json(generateError('Maximum of 10 keys are allowed.'));
      }
      for (let i = 0; i < bodyKeys.length; i++) {
        const key = bodyKeys[i]!;
        const value = req.body[key as keyof typeof req.body];
        if (key.length > 100) {
          return res.status(400).json(generateError(`Key length must be between 1 and 100 characters.`));
        }
        if (typeof value !== 'string') {
          if (value.length > 500) {
            return res.status(400).json(generateError(`Value length must be between 1 and 500 characters.`));
          }
        }

        return res.status(400).json(generateError('Invalid key type ' + key));
      }
    }
  }

  const [status, error] = await buttonClick({
    channelId,
    messageId,
    buttonId,
    clickedUserId: req.userCache.id,
    data: req.body,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
