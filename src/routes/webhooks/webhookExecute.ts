import { Request, Response, Router } from 'express';
import { webhookAuthenticate } from '../../common/webhookAuthenticate';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { checkAndUpdateRateLimit } from '../../cache/RateLimitCache';
import { body } from 'express-validator';
import env from '../../common/env';
import { createMessage } from '../../services/Message/Message';
import { MessageType } from '../../types/Message';

export function webhookkExecute(Router: Router) {
  Router.post(
    '/webhooks/:webhookId/:token',
    body('content').optional(true).isString().withMessage('Content must be a string!').isLength({ min: 1, max: 2000 }).withMessage('Content length must be between 1 and 2000 characters.'),

    route
  );
}

interface Body {
  content: string;
}

const rateLimitCheck = async (channelId: string) => {
  if (env.DEV_MODE) return false;
  const ttl = await checkAndUpdateRateLimit({
    id: `${channelId}-wh-exec`,
    requests: 10,
    perMS: 5000,
    restrictMS: 5000,
  });
  return ttl;
};

async function route(req: Request<{ webhookId: string; token: string }, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!req.body.content) return res.status(400).json(generateError('Content is required.'));

  const webhookId = req.params.webhookId;
  const token = req.params.token;

  const webhookCache = await webhookAuthenticate(webhookId, token);

  if (!webhookCache) return res.status(401).json(generateError('Invalid webhook token.'));

  const ttl = await rateLimitCheck(webhookCache.channelId);

  if (ttl) return res.status(429).json(generateError('Rate limit exceeded.'));

  const [result, error] = await createMessage({
    channelId: webhookCache.channelId,
    type: MessageType.CONTENT,
    content: req.body.content,
    webhookId: webhookCache.id,
    serverId: webhookCache.serverId,
  });
  if (error) return res.status(400).json(error);

  res.json(result);
}
