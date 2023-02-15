import { Post } from '@prisma/client';
import { CustomResult } from '../common/CustomResult';
import { dateToDateTime, prisma } from '../common/database';
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


export async function editPost(opts: {editById: string, postId: string, content: string}) {
  const post = await prisma.post.findFirst({where: { createdById: opts.editById, deleted: null, id: opts.postId}, select: {id: true}});
  if (!post) return [null, generateError('Post not found')] as const;

  const newPost = await prisma.post.update({
    where: {id: opts.postId},
    data: {
      content: opts.content.trim(),
      editedAt: dateToDateTime()
    },
    include: constructInclude(opts.editById)
  });

  return [newPost, null] as const;
}

export async function getPostLikes(postId: string) {
  const post = await prisma.post.findFirst({where: { deleted: null, id:postId}, select: {id: true}});
  if (!post) return [null, generateError('Post not found')] as const;

  const postLikedByUsers = await prisma.postLike.findMany({
    where: {postId},
    orderBy: {createdAt: 'desc'},
    select: {likedBy: true, createdAt: true}
  });


  return [postLikedByUsers, null];
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
      deleted: null,
    },
    orderBy: {createdAt: 'asc'},
    take: 50,
    include: constructInclude(opts.requesterUserId)
  });

  return posts;
}

export async function fetchLikedPosts(userId: string, requesterUserId: string) {
  const likes = await prisma.postLike.findMany({
    where: {likedById: userId},
    include: {post: {include: constructInclude(requesterUserId)}},
    orderBy: {createdAt: 'asc'},
    take: 50,
  });

  return likes.map(like => like.post);
}

export async function fetchLatestPost(userId: string, requesterUserId: string) {
  const latestPost = await prisma.post.findFirst({ orderBy: {createdAt: 'desc'}, where: { deleted: null, commentToId: null, createdBy: {id: userId}}, include: constructInclude(requesterUserId)});
  return latestPost;
}

export async function fetchPost(postId: string, requesterUserId: string) {
  const post = prisma.post.findFirst({
    where: {
      id: postId,
    },
    orderBy: {createdAt: 'desc'},
    take: 50,
    include: constructInclude(requesterUserId)
  });

  return post;
}

export async function likePost(userId: string, postId: string): Promise<CustomResult<Post, CustomError>> {
  const post = await prisma.post.findFirst({where: {deleted: null, id: postId}});
  if (!post) return [null, generateError('Post not found')];

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


export async function deletePost(postId: string, userId: string): Promise<CustomResult<boolean, CustomError>> {
  const post = await prisma.post.findFirst({where: {id: postId, createdById: userId}});
  if (!post) {
    return [null, generateError('Post does not exist!')];
  }
  await prisma.$transaction([
    prisma.post.update({
      where: {id: postId},
      data: {
        content: null,
        deleted: true,
      }
    }),
    prisma.postLike.deleteMany({where: {postId}})
  ]);

  return [true, null];
}

export async function getFeed(userId: string) {
  const feedPosts = await prisma.post.findMany({
    orderBy: {createdAt: 'desc'},
    where: {
      commentTo: null,
      deleted: null, 
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