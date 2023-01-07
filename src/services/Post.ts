import { Post } from '@prisma/client';
import { CustomResult } from '../common/CustomResult';
import { prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';

interface CreatePostOpts {
  userId: string;
  content: string;
}
export function createPost(opts: CreatePostOpts) {
  const post = prisma.post.create({
    data: {
      id: generateId(),
      content: opts.content.trim(),
      createdById: opts.userId,
    },
    include: {
      createdBy: true,
      _count: {select: {likedBy: true}},
      likedBy: {select: {id: true},where: {likedById: opts.userId}}
    }
  });

  return post;
}


interface FetchPostsOpts {
  userId: string;
  requesterUserId: string;
} 

export async function fetchPosts(opts: FetchPostsOpts) {

  const posts = await prisma.post.findMany({
    where: {
      createdById: opts.userId
    },
    orderBy: {createdAt: 'desc'},
    take: 50,
    include: {
      createdBy: true,
      _count: {select: {likedBy: true}},
      likedBy: {select: {id: true},where: {likedById: opts.requesterUserId}}
    }
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
    include: {
      createdBy: true,
      _count: {select: {likedBy: true}},
      likedBy: {select: {id: true},where: {likedById: requesterUserId}}
    }
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