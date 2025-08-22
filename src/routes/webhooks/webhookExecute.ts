import { Request, Response, Router } from 'express';
import { webhookAuthenticate } from '../../common/webhookAuthenticate';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { checkAndUpdateRateLimit } from '../../cache/RateLimitCache';
import { body } from 'express-validator';
import env from '../../common/env';
import { createMessage } from '../../services/Message/Message';
import { MessageType } from '../../types/Message';
import { hasBadWord } from '../../common/badWords';

export function webhookkExecute(Router: Router) {
  Router.post(
    '/webhooks/:webhookId/:token',
    body('content').optional(true).isString().withMessage('Content must be a string!').isLength({ min: 1, max: 2000 }).withMessage('Content length must be between 1 and 2000 characters.'),

    body('avatarUrl').optional(true).isString().withMessage('Avatar URL must be a string!').isLength({ min: 1, max: 255 }).withMessage('Avatar URL length must be between 1 and 255 characters.'),
    body('username').optional(true).isString().withMessage('Invalid username.').not().contains('@').withMessage('Username cannot contain the @ symbol').not().contains(':').withMessage('Username cannot contain the : symbol').isLength({ min: 3, max: 35 }).withMessage('Username must be between 3 and 35 characters long.'),

    route
  );
}

interface Body {
  content?: string;
  avatarUrl?: string;
  username?: string;
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

  if (req.body.username?.trim()) {
    if (hasBadWord(req.body.username)) {
      return res.status(400).json(generateError('Username cannot contain bad words.', 'username'));
    }
  }

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

    avatar_url_override: req.body.avatarUrl,
    username_override: req.body.username,
  });
  if (error) return res.status(400).json(error);

  res.json(result);
}
