import { Post, Prisma } from '@prisma/client';
import { CustomResult } from '../common/CustomResult';
import { dateToDateTime, prisma } from '../common/database';
import { CustomError, generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { deleteImage } from '../common/nerimityCDN';
import { FriendStatus } from '../types/Friend';
import { getBlockedUserIds } from './User/User';

function constructInclude(
  requesterUserId: string,
  continueIter = true
): Prisma.PostInclude | null | undefined {
  return {
    ...(continueIter
      ? { commentTo: { include: constructInclude(requesterUserId, false) } }
      : undefined),
    createdBy: true,
    _count: { select: { likedBy: true, comments: true } },
    likedBy: { select: { id: true }, where: { likedById: requesterUserId } },
    attachments: {
      select: { height: true, width: true, path: true, id: true },
    },
  };
}

interface CreatePostOpts {
  userId: string;
  content?: string;
  commentToId?: string;
  attachment?: { width?: number; height?: number; path: string };
}
export async function createPost(opts: CreatePostOpts) {

  if (opts.commentToId) {
    const comment = await prisma.post.findUnique({
      where: { id: opts.commentToId },
    })
    if (!comment) {
      return [null, generateError('Comment not found')] as const
    }
    const blockedUserIds = await getBlockedUserIds([comment.createdById], opts.userId);
    if (blockedUserIds.length) {
      return [null, generateError('You have been blocked by this user!')] as const
    }

  }

  const post = await prisma.post.create({
    data: {
      id: generateId(),
      content: opts.content?.trim(),
      createdById: opts.userId,
      ...(opts.commentToId ? { commentToId: opts.commentToId } : undefined),
      ...(opts.attachment
        ? {
          attachments: {
            create: {
              id: generateId(),
              height: opts.attachment.height,
              width: opts.attachment.width,
              path: opts.attachment.path,
            },
          },
        }
        : undefined),
    },
    include: constructInclude(opts.userId),
  });

  if (opts.commentToId) {
    createPostNotification({
      byId: opts.userId,
      postId: post.id,
      type: PostNotificationType.REPLIED,
    });
  }

  return [post, null] as const;
}

export async function editPost(opts: {
  editById: string;
  postId: string;
  content: string;
}) {
  const post = await prisma.post.findFirst({
    where: { createdById: opts.editById, deleted: null, id: opts.postId },
    select: { id: true },
  });
  if (!post) return [null, generateError('Post not found')] as const;

  const newPost = await prisma.post
    .update({
      where: { id: opts.postId },
      data: {
        content: opts.content.trim(),
        editedAt: dateToDateTime(),
      },
      include: constructInclude(opts.editById),
    })
    .catch(() => { });

  if (!newPost)
    return [
      null,
      generateError('Something went wrong. Try again later.'),
    ] as const;

  return [newPost, null] as const;
}

export async function getPostLikes(postId: string) {
  const post = await prisma.post.findFirst({
    where: { deleted: null, id: postId },
    select: { id: true },
  });
  if (!post) return [null, generateError('Post not found')] as const;

  const postLikedByUsers = await prisma.postLike.findMany({
    where: { postId },
    orderBy: { createdAt: 'desc' },
    select: { likedBy: true, createdAt: true },
  });

  return [postLikedByUsers, null];
}

interface FetchPostsOpts {
  userId?: string;
  postId?: string; // get comments
  requesterUserId: string;
  withReplies?: boolean;
}

export async function fetchPosts(opts: FetchPostsOpts) {
  const posts = await prisma.post.findMany({
    where: {
      ...(opts.userId ? { createdById: opts.userId } : undefined),
      ...(opts.userId && !opts.withReplies ? { commentToId: null } : undefined),
      ...(opts.postId ? { commentToId: opts.postId } : undefined),
      deleted: null,
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
    include: constructInclude(opts.requesterUserId),
  });

  return blockedCheckResult(posts, opts.requesterUserId);
}

export async function fetchLikedPosts(userId: string, requesterUserId: string) {
  const likes = await prisma.postLike.findMany({
    where: { likedById: userId },
    include: { post: { include: constructInclude(requesterUserId) } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  return blockedCheckResult(likes, requesterUserId);
}

export async function fetchLatestPost(userId: string, requesterUserId: string) {
  const post = await prisma.post.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { deleted: null, commentToId: null, createdBy: { id: userId } },
    include: constructInclude(requesterUserId),
  });

  if (!post) return null;

  return (await blockedCheckResult([post], requesterUserId))[0];
}

const constructBlockedPostTemplate = (post: Post & { commentTo?: Post }) => {
  return {
    id: post.id,
    commentToId: post.commentToId,
    createdBy: post.createdBy,
    commentTo: post.commentTo,
    quotedPostId: post.quotedPostId,
    block: true,
  }
}

type PostWithCommentTo = Partial<Post> & {
  commentTo?: Partial<Post>;
}

export async function blockedCheckResult(posts: PostWithCommentTo[], requesterUserId: string) {
  const blockedUserIds = await getBlockedUserIds(getAllUserIdsFromPosts(posts), requesterUserId);
  if (!blockedUserIds.length) return posts;

  const customPosts: (PostWithCommentTo[]) = reconstructPostsIfBlocked(blockedUserIds, posts);

  return customPosts;
}

const getAllUserIdsFromPosts = (posts: PostWithCommentTo[]) => {
  const userIds: string[] = [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    if (!post) continue;
    userIds.push(post.createdById!);
    if (post.commentTo) {
      userIds.push(...getAllUserIdsFromPosts([post.commentTo]));
    }
  }
  return userIds;
}

const reconstructPostsIfBlocked = (blockedByUserIds: string[], posts: PostWithCommentTo[]) => {
  const customPosts: (PostWithCommentTo[]) = [];

  for (let i = 0; i < posts.length; i++) {
    let post: PostWithCommentTo = { ...posts[i] };
    if (!post) continue;
    if (post.createdById && blockedByUserIds.includes(post.createdById)) {
      post = constructBlockedPostTemplate(post as Post);
    }
    if (post.commentTo) {
      post.commentTo = reconstructPostsIfBlocked(blockedByUserIds, [post.commentTo as Post])[0];
    }
    customPosts.push(post);
  }
  return customPosts;
}

export async function fetchPost(postId: string, requesterUserId: string) {
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: constructInclude(requesterUserId),
  });
  if (!post) return null;

  return (await blockedCheckResult([post], requesterUserId))[0];
}

export async function likePost(
  userId: string,
  postId: string
): Promise<CustomResult<Post, CustomError>> {
  const post = await prisma.post.findFirst({
    where: { deleted: null, id: postId },
  });
  if (!post) return [null, generateError('Post not found')];

  const existingPost = await prisma.postLike.findFirst({
    where: { likedById: userId, postId },
    select: { id: true },
  });
  if (existingPost) {
    return [null, generateError('You have already liked this post!')];
  }

  const blockedUserIds = await getBlockedUserIds([post.createdById], userId);
  if (blockedUserIds.length) {
    return [null, generateError('You have been blocked by this user!')]
  }

  await prisma.postLike.create({
    data: {
      id: generateId(),
      likedById: userId,
      postId,
    },
  });
  const newPost = (await fetchPost(postId, userId)) as Post;

  createPostNotification({
    type: PostNotificationType.LIKED,
    byId: userId,
    postId,
  });

  return [newPost, null];
}

export async function unlikePost(
  userId: string,
  postId: string
): Promise<CustomResult<Post, CustomError>> {
  const postLike = await prisma.postLike.findFirst({
    where: { likedById: userId, postId },
  });
  if (!postLike) {
    return [null, generateError('You have not liked this post!')];
  }

  await prisma.postLike.delete({
    where: { id: postLike.id },
  });
  const newPost = (await fetchPost(postId, userId)) as Post;
  return [newPost, null];
}

export async function deletePost(
  postId: string,
  userId: string
): Promise<CustomResult<boolean, CustomError>> {
  const post = await prisma.post.findFirst({
    where: { id: postId, createdById: userId },
    include: { attachments: true },
  });
  if (!post) {
    return [null, generateError('Post does not exist!')];
  }

  if (post.attachments?.[0]?.path) {
    deleteImage(post.attachments[0].path);
  }

  await prisma.$transaction([
    prisma.post.update({
      where: { id: postId },
      data: {
        content: null,
        deleted: true,
      },
    }),
    prisma.postLike.deleteMany({ where: { postId } }),
  ]);

  return [true, null];
}

export async function getFeed(userId: string) {
  const feedPosts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    where: {
      commentTo: null,
      deleted: null,
      OR: [
        { createdById: userId },
        {
          createdBy: {
            followers: {
              some: { followedById: userId },
            },
          },
        },
      ],
    },
    include: constructInclude(userId),
    take: 50,
  });
  return feedPosts;
}

export enum PostNotificationType {
  LIKED = 0,
  REPLIED = 1,
  FOLLOWED = 2,
}

interface CreatePostNotificationProps {
  toId?: string;
  byId: string;
  postId?: string;
  type: PostNotificationType;
}

export async function createPostNotification(
  opts: CreatePostNotificationProps
) {
  let toId = opts.toId;

  if (
    opts.type === PostNotificationType.LIKED ||
    opts.type === PostNotificationType.REPLIED
  ) {
    const post = await prisma.post.findFirst({
      where: { id: opts.postId },
      select: { createdById: true },
    });
    if (!post) return;
    toId = post.createdById;
  }

  if (opts.type === PostNotificationType.REPLIED) {
    const post = await prisma.post.findFirst({
      where: { id: opts.postId },
      select: { commentTo: { select: { createdById: true } } },
    });
    if (!post) return;
    toId = post.commentTo?.createdById;
  }

  if (!toId) return;

  if (opts.toId === opts.byId) return;

  const alreadyExists = await prisma.postNotification.findFirst({
    where: {
      byId: opts.byId,
      toId: toId,
      type: opts.type,
      postId: opts.postId,
    },
  });
  if (alreadyExists) return;

  await prisma
    .$transaction([
      prisma.postNotification.create({
        data: {
          id: generateId(),
          byId: opts.byId,
          toId: toId,
          type: opts.type,
          postId: opts.postId,
        },
      }),
      prisma.account.update({
        where: { userId: toId },
        data: {
          postNotificationCount: { increment: 1 },
        },
      }),
    ])
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .catch(() => { });

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
    orderBy: { createdAt: 'desc' },
    where: { toId: userId },
    take: 10,
    include: {
      by: true,
      post: { include: constructInclude(userId) },
    },
  });
}

export async function getPostNotificationCount(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId },
    select: { postNotificationCount: true },
  });
  return account?.postNotificationCount;
}
export async function dismissPostNotification(userId: string) {
  await prisma.account.update({
    where: { userId },
    data: { postNotificationCount: 0 },
  });
}
