import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';
import { webhookAuthenticate } from '../../common/webhookAuthenticate';
import { generateError } from '../../common/errorHandler';
import { checkAndUpdateRateLimit } from '../../cache/RateLimitCache';

export function webhookkExecute(Router: Router) {
  Router.post(
    '/webhooks/:webhookId/:token',

    route
  );
}

interface Body {}

const rateLimitCheck = async (channelId: string) => {
  const ttl = await checkAndUpdateRateLimit({
    id: `${channelId}-wh-exec`,
    requests: 10,
    perMS: 5000,
    restrictMS: 5000,
  });
  return ttl;
};

async function route(req: Request<{ webhookId: string; token: string }, unknown, Body>, res: Response) {
  const webhookId = req.params.webhookId;
  const token = req.params.token;

  const webhookCache = await webhookAuthenticate(webhookId, token);

  if (!webhookCache) return res.status(401).json(generateError('Invalid webhook token.'));

  const ttl = await rateLimitCheck(webhookCache.channelId);

  if (ttl) return res.status(429).json(generateError('Rate limit exceeded.'));
}
