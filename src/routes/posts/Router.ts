import {Router} from 'express';
import { postsGet } from './postsGet';
import { postCreate } from './postCreate';
import { postLike } from './postLike';
import { postUnlike } from './postUnlike';

const PostsRouter = Router();

postsGet(PostsRouter);
postCreate(PostsRouter);
postLike(PostsRouter);
postUnlike(PostsRouter);

export {PostsRouter};