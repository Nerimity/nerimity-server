import { redisClient } from '../common/redis';
import { POST_VIEWS_KEY } from './CacheKeys';

export function addPostViewsToCache(postIds: string[], ip: string) {
  const multi = redisClient.multi();
  for (let i = 0; i < postIds.length; i++) {
    const postId = postIds[i];
    if (!postId) continue;
    const key = POST_VIEWS_KEY(postId);
    multi.sAdd(key, ip);
    multi.sAdd(POST_VIEWS_KEY('id'), postId);
  }
  return multi.exec();
}

export async function getAndRemovePostViewsCache() {
  const postIds = await redisClient.sMembers(POST_VIEWS_KEY('id'));
  if (!postIds.length) return [];

  const multi = redisClient.multi();

  for (let i = 0; i < postIds.length; i++) {
    const postId = postIds[i];
    if (!postId) continue;
    const key = POST_VIEWS_KEY(postId);
    multi.sCard(key);
  }
  const results = await multi.exec();

  const data = results.map((views, i) => ({
    id: postIds[i]!,
    views: views as number,
  }));

  const keys = [POST_VIEWS_KEY('id'), ...postIds.map(POST_VIEWS_KEY)];
  redisClient.del(keys);
  return data;
}
