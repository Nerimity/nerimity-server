import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { searchMessagesByChannelId } from '../../services/Message/Message';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ChannelType } from '../../types/Channel';
import { body } from 'express-validator';

export function channelMessagesSearch(Router: Router) {
  Router.get(
    '/channels/:channelId/messages/search',
    authenticate(),
    channelVerification(),
    body('query').isString().withMessage('Invalid query.').isLength({ min: 3, max: 35 }).withMessage('query must be between 3 and 35 characters long.'),

    rateLimit({
      name: 'messages_search',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

interface Body {
  query: string;
}

async function route(req: Request, res: Response) {
  const limit = parseInt((req.query.limit as string) || '50') || undefined;
  const after = (req.query.after as string) || undefined;
  const before = (req.query.before as string) || undefined;
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.channelCache.type === ChannelType.CATEGORY) {
    return res.status(400).json(generateError('Cannot get messages from a category channel'));
  }

  const t1 = performance.now();
  const messages = await searchMessagesByChannelId(req.channelCache.id, {
    query: body.query,
    limit,
    afterMessageId: after,
    beforeMessageId: before,
    requesterId: req.userCache.id,
  });

  res.setHeader('T-msg-took', (performance.now() - t1).toFixed(2) + 'ms');
  res.json(messages);
}
