import { fetchWebhookCache } from '../cache/WebhookCache';
import env from './env';
import { decryptToken } from './JWT';

export const webhookAuthenticate = async (id: string, token: string) => {
  const decryptedToken = decryptToken(token, env.JWT_WEBHOOK_SECRET);
  const tokenWebhookId = decryptedToken?.userId;

  if (!decryptedToken) return false;
  if (tokenWebhookId !== id) return false;

  const webhookCache = await fetchWebhookCache({ id });

  if (!webhookCache) return false;

  return webhookCache;
};
