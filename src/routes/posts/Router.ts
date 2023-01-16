import {Router} from 'express';
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

const PostsRouter = Router();



postNotificationDismiss(PostsRouter);
postNotificationCount(PostsRouter);
postNotifications(PostsRouter);
postsFeed(PostsRouter);
postGetSingle(PostsRouter);
postsGetLiked(PostsRouter);
postsGet(PostsRouter);
postCreate(PostsRouter);
postLike(PostsRouter);
postUnlike(PostsRouter);
postsGetComments(PostsRouter);

export {PostsRouter};