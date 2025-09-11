import { Post } from '@src/generated/prisma/client';
import { POST_MENTION } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';

export const emitPostMentions = (userIds: string[], post: Post) => {
  if (!userIds.length) return;

  const io = getIO();
  io.in(userIds).emit(POST_MENTION, { post });
};
