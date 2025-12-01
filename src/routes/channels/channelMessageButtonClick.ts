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

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const bodyKeys = Object.keys(req.body);

    if (bodyKeys.length > 10) {
      return res.status(400).json(generateError('Maximum of 10 keys are allowed.'));
    }

    for (const key of bodyKeys) {
      if (key.length === 0 || key.length > 100) {
        return res.status(400).json(generateError('Key length must be between 1 and 100 characters.'));
      }

      const value = req.body[key as keyof typeof req.body];

      if (typeof value !== 'string') {
        return res.status(400).json(generateError('Invalid value type for key ' + key));
      }

      if (value.length === 0 || value.length > 500) {
        return res.status(400).json(generateError('Value length must be between 1 and 500 characters.'));
      }
    }
  } else {
    req.body = {};
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
