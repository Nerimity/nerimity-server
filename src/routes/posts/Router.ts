import { Router } from 'express';
import { postsGet } from './postsGet';
import { postCreate } from './postCreate';
import { postLike } from './postLike';
import { postUnlike } from './postUnlike';
import { postsGetComments } from './postGetComments';
import { postGetSingle } from './postGetSingle';
import { postsFeed } from './postsFeed';
import { postNotifications } from './postNotifications';
import { postNotificationCount } from './postNotificationCount';
import { postNotificationDismiss } from './postNotificationDismiss';
import { postsGetLiked } from './postsGetLiked';
import { postDelete } from './postDelete';
import { postEdit } from './postEdit';
import { postsGetLikes } from './postGetLikes';
import { postsDiscover } from './postsDiscover';
import { postPollVote } from './postPollVote';
import { postsGetAnnouncement } from './postsGetAnnouncement';
import { postPin } from './postPin';
import { postPinDelete } from './postPinDelete';
import { postRepost } from './postRepost';
import { postGetReposts } from './postGetReposts';

const PostsRouter = Router();

postsGetAnnouncement(PostsRouter);

postPollVote(PostsRouter);
postNotificationDismiss(PostsRouter);
postNotificationCount(PostsRouter);
postNotifications(PostsRouter);
postsFeed(PostsRouter);
postsDiscover(PostsRouter);

postGetSingle(PostsRouter);
postsGetLiked(PostsRouter);
postDelete(PostsRouter);
postsGet(PostsRouter);
postCreate(PostsRouter);
postRepost(PostsRouter);
postEdit(PostsRouter);
postLike(PostsRouter);
postUnlike(PostsRouter);
postsGetComments(PostsRouter);
postsGetLikes(PostsRouter);
postGetReposts(PostsRouter);

postPin(PostsRouter);
postPinDelete(PostsRouter);

export { PostsRouter };
