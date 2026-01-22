import { safeExec } from '@src/common/utils';
import { redisClient } from '../common/redis';
import { POST_VIEWS_KEY } from './CacheKeys';

export function addPostViewsToCache(postIds: string[], ip: string) {
  const multi = redisClient.pipeline();
  for (let i = 0; i < postIds.length; i++) {
    const postId = postIds[i];
    if (!postId) continue;
    const key = POST_VIEWS_KEY(postId);
    multi.sadd(key, ip);
    multi.sadd(POST_VIEWS_KEY('id'), postId);
  }
  return multi.exec();
}

export async function getAndRemovePostViewsCache() {
  const postIds = await redisClient.smembers(POST_VIEWS_KEY('id'));
  if (!postIds.length) return [];

  const multi = redisClient.pipeline();

  for (let i = 0; i < postIds.length; i++) {
    const postId = postIds[i];
    if (!postId) continue;
    const key = POST_VIEWS_KEY(postId);
    multi.scard(key);
  }
  const results = await safeExec<number[]>(multi);

  const data = results.map((views, i) => ({
    id: postIds[i]!,
    views: views as number,
  }));

  const keys = [POST_VIEWS_KEY('id'), ...postIds.map(POST_VIEWS_KEY)];
  redisClient.del(keys);
  return data;
}
