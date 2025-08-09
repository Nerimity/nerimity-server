import { Request, Response, Router } from 'express';
import { param } from 'express-validator';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getMessageByChannelId, markMessageUnread } from '../../services/Message/Message';
import { generateError } from '../../common/errorHandler';
import { ChannelType } from '../../types/Channel';

export function channelMessageMarkUnread(Router: Router) {
  Router.post(
    '/channels/:channelId/messages/:messageId/mark-unread',
    authenticate({ allowBot: true }),
    channelVerification(),
    rateLimit({
      name: 'channel_unread',
      restrictMS: 30000,
      requests: 30,
    }),
    param('messageId').isString().withMessage('messageId must be a string!').isLength({ min: 1, max: 100 }).withMessage('messageId length must be between 1 and 100 characters.'),
    route
  );
}

interface Param {
  messageId: string;
}

async function route(req: Request, res: Response) {
  const params = req.params as unknown as Param;

  if (req.channelCache.type === ChannelType.CATEGORY) {
    return res.status(400).json(generateError('Cannot get messages from a category channel'));
  }

  const messages = await markMessageUnread({
    messageId: params.messageId,
    channelId: req.channelCache.id,
    userId: req.userCache.id,
  });
  res.json(messages);
}
