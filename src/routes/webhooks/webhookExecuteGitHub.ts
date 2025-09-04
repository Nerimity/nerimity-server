import { Request, Response, Router } from 'express';
import { webhookAuthenticate } from '../../common/webhookAuthenticate';
import { generateError } from '../../common/errorHandler';
import { checkAndUpdateRateLimit } from '../../cache/RateLimitCache';
import env from '../../common/env';
import { createMessage } from '../../services/Message/Message';
import { MessageType } from '../../types/Message';
import { EmitterWebhookEvent } from '@octokit/webhooks';

export function webhookkExecuteGitHub(Router: Router) {
  Router.post('/webhooks/:webhookId/:token/github', route);
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

async function route(req: Request<{ webhookId: string; token: string }, unknown, EmitterWebhookEvent['payload']>, res: Response) {
  const webhookId = req.params.webhookId;
  const token = req.params.token;

  const webhookCache = await webhookAuthenticate(webhookId, token);

  if (!webhookCache) return res.status(401).json(generateError('Invalid webhook token.'));

  const ttl = await rateLimitCheck(webhookCache.channelId);

  if (ttl) return res.status(429).json(generateError('Rate limit exceeded.'));

  const body = {
    name: (req.headers['x-github-event'] as string) || '',
    payload: req.body,
  } as EmitterWebhookEvent;

  const payload = body.payload;

  const user = payload.sender ? payload.sender.login : 'Someone';

  let content = '';

  if (body.name === 'pull_request') {
    const payload = body.payload;
    content = `${user} just a **pull request** titled: "${payload.pull_request.title}\n${payload.pull_request.html_url}"`;
  }
  if (body.name === 'push') {
    const payload = body.payload;

    if (payload.ref.startsWith('refs/tags/')) {
      const tagName = payload.ref.split('/').pop();
      content = `${user} just pushed a new tag: **${tagName}**`;
    } else {
      content = `${user} just pushed to **${payload.ref.split('/').pop()}** branch.\n${payload.commits.map((commit) => `[🔗](${commit.url}) ${commit.message}`).join('\n')}`;
    }
  }

  if (body.name === 'release') {
    if ('action' in body.payload && body.payload.action === 'published') {
      const payload = body.payload;
      content = `${user} just published a new release: **${payload.release.tag_name}**! 🚀 [🔗](${payload.release.url})`;
    }
  }

  if (!content) {
    res.status(200).end();
    return;
  }

  content = content.substring(0, 2000);

  const [, error] = await createMessage({
    channelId: webhookCache.channelId,
    type: MessageType.CONTENT,
    content,
    webhookId: webhookCache.id,
    avatar_url_override: 'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',
    serverId: webhookCache.serverId,
  });
  if (error) return res.status(400).json(error);

  res.status(200).end();
}
