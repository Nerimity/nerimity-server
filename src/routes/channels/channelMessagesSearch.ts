import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { searchMessagesByChannelId } from '../../services/Message/Message';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { ChannelType } from '../../types/Channel';
import { query } from 'express-validator';
import { ensureArray } from '@src/common/utils';

export function channelMessagesSearch(Router: Router) {
  Router.get(
    '/channels/:channelId/messages/search',
    authenticate(),
    channelVerification(),
    query('query').isString().withMessage('Invalid query.').isLength({ min: 1, max: 50 }).withMessage('query must be between 1 and 50 characters long.').optional({ nullable: true }),
    query('order').isString().withMessage('Invalid order.').isLength({ min: 1, max: 50 }).withMessage('order must be between 1 and 50 characters long.').optional({ nullable: true }),
    query('user_id').optional({ nullable: true }).isString().withMessage('Invalid user_id.').isLength({ min: 1, max: 100 }).withMessage('user_id must be between 1 and 100 characters long.').optional({ nullable: true }),

    rateLimit({
      name: 'messages_search',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const limit = parseInt((req.query.limit as string) || '50') || undefined;
  const after = (req.query.after as string) || undefined;
  const before = (req.query.before as string) || undefined;
  const query = req.query.query as string;
  const order = (req.query.order || 'desc') as 'asc' | 'desc';
  const userIds = ensureArray(req.query.user_id);

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!['desc', 'asc'].includes(order)) {
    return res.status(400).json(generateError('Invalid order.'));
  }

  if (req.channelCache.type === ChannelType.CATEGORY) {
    return res.status(400).json(generateError('Cannot get messages from a category channel'));
  }

  const t1 = performance.now();
  const messages = await searchMessagesByChannelId(req.channelCache.id, {
    query,
    order,
    limit,
    afterMessageId: after,
    beforeMessageId: before,
    requesterId: req.userCache.id,
    userIds,
  });

  res.setHeader('T-msg-took', (performance.now() - t1).toFixed(2) + 'ms');
  res.json(messages);
}
