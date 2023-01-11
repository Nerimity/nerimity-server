import { Post } from '@prisma/client';
import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';

function constructInclude(requesterUserId: string, continueIter = true): any {
  return {
    ...(continueIter ? {commentTo: {include: constructInclude(requesterUserId, false)}} :  undefined),
    createdBy: true,
    _count: {select: {likedBy: true, comments: true}},
    likedBy: {select: {id: true},where: {likedById: requesterUserId}}
  };
}

interface CreatePostOpts {
  userId: string;
  content: string;
  commentToId?: string
}
export function createPost(opts: CreatePostOpts) {
  const post = prisma.post.create({
    data: {
      id: generateId(),
      content: opts.content.trim(),
      createdById: opts.userId,
      ...(opts.commentToId ? {commentToId: opts.commentToId} : undefined)
    },
    include: constructInclude(opts.userId)
  });

  return post;
}

interface FetchPostsOpts {
  userId?: string;
  postId?: string; // get comments
  requesterUserId: string;
  withReplies?: boolean
} 

export async function fetchPosts(opts: FetchPostsOpts) {
  const posts = await prisma.post.findMany({
    where: {
      ...(opts.userId ? {createdById: opts.userId} : undefined),
      ...((opts.userId && !opts.withReplies)? {commentToId: null} : undefined),
      ...(opts.postId ? {commentToId: opts.postId} : undefined),
    },
    orderBy: {createdAt: 'asc'},
    take: 50,
    include: constructInclude(opts.requesterUserId)
  });

  return posts;
}

export async function fetchPost(postId: string, requesterUserId: string) {
  const post = prisma.post.findFirst({
    where: {
      id: postId
    },
    orderBy: {createdAt: 'desc'},
    take: 50,
    include: constructInclude(requesterUserId)
  });

  return post;
}

export async function likePost(userId: string, postId: string): Promise<CustomResult<Post, CustomError>> {
  const exists = await prisma.postLike.count({where: {likedById: userId, postId}});
  if (exists) {
    return [null, generateError('You have already liked this post!')];
  }
  
  await prisma.postLike.create({
    data: {
      id: generateId(),
      likedById: userId,
      postId,
    }
  });
  const newPost = await fetchPost(postId, userId) as Post;
  return [newPost, null];
}

export async function unlikePost(userId: string, postId: string): Promise<CustomResult<Post, CustomError>> {
  const postLike = await prisma.postLike.findFirst({where: {likedById: userId, postId}});
  if (!postLike) {
    return [null, generateError('You have not liked this post!')];
  }
  
  await prisma.postLike.delete({
    where: { id: postLike.id}
  });
  const newPost = await fetchPost(postId, userId) as Post;
  return [newPost, null];
}


export async function deletePost(postId: string): Promise<CustomResult<boolean, CustomError>> {
  const postExists = await prisma.post.count({where: {id: postId}});
  if (!postExists) {
    return [null, generateError('Post does not exist!')];
  }
  await prisma.post.delete({
    where: {id: postId}
  });
  return [true, null];
}

export async function getFeed(userId: string) {
  const feedPosts = await prisma.post.findMany({
    orderBy: {createdAt: 'desc'},
    where: {
      commentTo: null,
      OR: [
        {createdById: userId},
        {
          createdBy: {
            followers: {
              some: {followedById: userId}
            }
          }
        }
      ]
    },
    include: constructInclude(userId),
    take: 50,
  });
  return feedPosts;
}