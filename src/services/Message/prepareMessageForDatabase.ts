import { prisma } from '../../common/database';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { MessageType } from '../../types/Message';

interface PrepareMessageForDatabaseOpts {
  content?: string;
  canMentionRoles?: boolean;
  serverId?: string;
  channelId: string;
  creatorId?: string;
  replyToMessageIds?: string[];
}

const userMentionRegex = /\[@:([\d]+)]/g;
const roleMentionRegex = /\[r:([\d]+)]/g;
const quoteMessageRegex = /\[q:([\d]+)]/g;

const processUserMentions = async (opts: PrepareMessageForDatabaseOpts) => {
  if (!opts.content?.trim()) return [];

  const mentionUserIds: string[] = removeDuplicates([...opts.content.matchAll(userMentionRegex)].map((m) => m[1]!));
  if (!mentionUserIds.length) return [];

  const mentions = await prisma.user.findMany({
    where: { id: { in: mentionUserIds } },
    select: { id: true },
  });
  return mentions;
};
const processRoleMentions = async (opts: PrepareMessageForDatabaseOpts) => {
  if (!opts.content?.trim()) return [];

  if (!opts.serverId) return [];
  if (!opts?.canMentionRoles) return [];

  const mentionRoleIds = removeDuplicates([...opts.content.matchAll(roleMentionRegex)].map((m) => m[1]!));

  if (!mentionRoleIds.length) return [];

  const mentions = await prisma.serverRole.findMany({
    where: {
      id: { in: mentionRoleIds },
    },
    select: { id: true },
  });
  return mentions;
};

const processQuotes = async (opts: PrepareMessageForDatabaseOpts) => {
  if (!opts.content?.trim()) return [];
  const quotedMessageIds = removeDuplicates([...opts.content.matchAll(quoteMessageRegex)].map((m) => m[1]!));
  if (!quotedMessageIds.length) return [];

  const messages = await prisma.message.findMany({
    where: {
      id: { in: quotedMessageIds },
      type: MessageType.CONTENT,
      ...(!opts.creatorId
        ? {
            channel: {
              OR: [
                { server: { serverMembers: { some: { userId: opts.creatorId } } } }, // is server member
                {
                  inbox: {
                    // is inbox channel
                    some: {
                      OR: [{ recipientId: opts.creatorId }, { createdById: opts.creatorId }],
                    },
                  },
                },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });
  return messages;
};

const handleReplies = async (opts: PrepareMessageForDatabaseOpts) => {
  if (!opts.replyToMessageIds?.length) return [];
  const replyToMessageIds = removeDuplicates(opts.replyToMessageIds);

  if (!replyToMessageIds.length) return [];

  const validReplyToMessages = await prisma.message.findMany({
    where: { id: { in: replyToMessageIds }, channelId: opts?.channelId },
    select: { id: true },
  });
  const validReplyToMessageIds = validReplyToMessages.map((m) => m.id);

  return validReplyToMessageIds.map((id) => ({ replyToMessageId: id, id: generateId() }));
};

export const prepareMessageForDatabase = async (opts: PrepareMessageForDatabaseOpts) => {
  const userMentions = await processUserMentions(opts);
  const roleMentions = await processRoleMentions(opts);
  const replies = await handleReplies(opts);
  const quotes = await processQuotes(opts);

  return {
    userMentions,
    roleMentions,
    replies,
    quotes,
  };
};
