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
export async function createPost(opts: CreatePostOpts) {
  const post = await prisma.post.create({
    data: {
      id: generateId(),
      content: opts.content.trim(),
      createdById: opts.userId,
      ...(opts.commentToId ? {commentToId: opts.commentToId} : undefined)
    },
    include: constructInclude(opts.userId)
  });

  if (opts.commentToId) {
    createPostNotification({
      byId: opts.userId,
      postId: post.id,
      type: PostNotificationType.REPLIED,
    });
  }


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
  const existingPost = await prisma.postLike.findFirst({where: {likedById: userId, postId}, select: {id: true}});
  if (existingPost) {
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

  createPostNotification({
    type: PostNotificationType.LIKED,
    byId: userId,
    postId,
  });

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


export enum PostNotificationType {
  LIKED = 0,
  REPLIED = 1,
  FOLLOWED = 2
}

interface CreatePostNotificationProps {
  toId?: string,
  byId: string,
  postId?: string
  type: PostNotificationType
}

export async function createPostNotification(opts: CreatePostNotificationProps){

  let toId = opts.toId;

  if (opts.type === PostNotificationType.LIKED || opts.type === PostNotificationType.REPLIED) {
    const post = await prisma.post.findFirst({where: {id: opts.postId}, select: {createdById: true}});
    if (!post) return;
    toId = post.createdById;
  }

  if (opts.type === PostNotificationType.REPLIED) {
    const post = await prisma.post.findFirst({where: {id: opts.postId}, select: {commentTo: {select: {createdById: true}}}});
    if (!post) return;
    toId = post.commentTo?.createdById;
  }

  if (!toId) return;

  if (opts.toId === opts.byId) return;


  const alreadyExists = await prisma.postNotification.findFirst(({
    where: {
      byId: opts.byId,
      toId: toId,
      type: opts.type,
      postId: opts.postId
    }
  }));
  if (alreadyExists) return;

  await prisma.$transaction([
    prisma.postNotification.create({
      data: {
        id: generateId(),
        byId: opts.byId,
        toId: toId,
        type: opts.type,
        postId: opts.postId
      }
    }),
    prisma.account.update({
      where: {userId: toId},
      data: {
        postNotificationCount: {increment: 1}
      }
    })
  ]);

  // // delete if more than 10 notifications exist
  // const tenthLatestRecord = await prisma.postNotification.findFirst({
  //   take: 1,
  //   skip: 9,
  //   where: {toId},
  //   orderBy: {id: 'desc'},
  //   select: {id: true}
  // });

  // if (!tenthLatestRecord) return;

  // await prisma.postNotification.deleteMany({
  //   where: { id: { lt: tenthLatestRecord.id}, toId }
  // });
}


export async function getPostNotifications(userId: string) {
  return await prisma.postNotification.findMany({
    orderBy: {createdAt: 'desc'},
    where: {toId: userId},
    take: 10,
    include: {
      by: true,
      post: {include: constructInclude(userId)}
    }
  });
}


export async function getPostNotificationCount(userId: string) {
  const account = await prisma.account.findFirst({where: {userId}, select: {postNotificationCount: true}});
  return account?.postNotificationCount;
}
export async function dismissPostNotification(userId: string) {
  await prisma.account.update({where: {userId}, data: {postNotificationCount: 0}});
}