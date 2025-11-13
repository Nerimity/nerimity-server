import { Prisma } from '@src/generated/prisma/client';
import { dateToDateTime, prisma } from '../common/database';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';
import { MessageInclude, transformMessage } from './Message/Message';
import { constructPostInclude } from './Post';
import { emitReminderAdd, emitReminderRemove, emitReminderUpdate } from '../emits/Reminder';
import { getChannelCache } from '../cache/ChannelCache';
import { getServerMemberCache } from '../cache/ServerMemberCache';

export const ReminderSelect = (userId: string) =>
  ({
    id: true,
    remindAt: true,
    createdAt: true,
    message: {
      include: {
        ...MessageInclude,
        reactions: {
          select: {
            reactedUsers: { where: { userId } },
            emojiId: true,
            gif: true,
            name: true,
            _count: {
              select: {
                reactedUsers: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    },
    post: { include: constructPostInclude('') },
    channelId: true,
  } satisfies Prisma.ReminderSelect);

export type PartialReminder = Prisma.ReminderGetPayload<{ select: ReturnType<typeof ReminderSelect> }>;

export const transformReminder = (reminder: PartialReminder) => {
  if (reminder.message) {
    return {
      ...reminder,
      message: transformMessage(reminder.message),
    };
  }
  return reminder;
};

export type TransformedReminder = ReturnType<typeof transformReminder>;
interface AddReminderOpts {
  userId: string;
  timestamp: number;
  messageId?: string;
  postId?: string;
}
export const addReminder = async (opts: AddReminderOpts) => {
  if (!opts.messageId && !opts.postId) return [null, generateError('messageId or postId is required.')] as const;
  if (opts.messageId && opts.postId) return [null, generateError('messageId and postId cannot be used together.')] as const;

  const count = await prisma.reminder.count({ where: { createdById: opts.userId } });

  if (count >= 10) return [null, generateError('You already created the maximum amount of reminders!')] as const;

  const reminderExists = await prisma.reminder.findFirst({ where: { createdById: opts.userId, OR: [{ messageId: opts.messageId }, { postId: opts.postId }] }, select: { id: true } });
  if (reminderExists) return [null, generateError('Reminder already exists!')] as const;

  let channelId: string | undefined;
  if (opts.messageId) {
    const message = await prisma.message.findUnique({ where: { id: opts.messageId, channel: { deleting: null } }, select: { channel: { select: { id: true, server: { select: { id: true } } } } } });
    if (!message) return [null, generateError('Message not found!')] as const;
    if (message.channel.server) {
      const [serverMember, serverMemberError] = await getServerMemberCache(message.channel.server.id, opts.userId);
      if (serverMemberError) return [null, serverMemberError] as const;
      if (!serverMember) return [null, generateError('You are not in this server!')] as const;
    }

    const [, channelError] = await getChannelCache(message.channel.id, opts.userId);
    if (channelError) return [null, channelError] as const;

    channelId = message.channel.id;
  }

  const reminder = await prisma.reminder
    .create({
      data: {
        id: generateId(),
        remindAt: dateToDateTime(opts.timestamp),
        messageId: opts.messageId,
        channelId,
        postId: opts.postId,
        createdById: opts.userId,
      },
      select: { ...ReminderSelect(opts.userId), post: { include: constructPostInclude(opts.userId) } },
    })
    .catch((err) => console.error(err));

  if (!reminder) return [null, generateError('Something went wrong. Try again later.')] as const;
  const transformedReminder = transformReminder(reminder);

  emitReminderAdd(opts.userId, transformedReminder);

  return [transformedReminder, null] as const;
};

export const getReminders = async (userId: string) => {
  const reminders = await prisma.reminder.findMany({ where: { createdById: userId }, select: { ...ReminderSelect(userId), post: { include: constructPostInclude(userId) } } });
  return reminders.map(transformReminder);
};

export const deleteReminder = async (reminderId: string, userId: string) => {
  const res = await prisma.reminder.delete({ where: { id: reminderId, createdById: userId } }).catch((err) => console.error(err));
  if (!res) return [null, generateError('Something went wrong. Try again later.')] as const;

  emitReminderRemove(userId, res.id);
  return [res, null] as const;
};

export const updateReminder = async (reminderId: string, userId: string, timestamp: number) => {
  const res = await prisma.reminder.update({ where: { id: reminderId, createdById: userId }, data: { remindAt: dateToDateTime(timestamp) }, select: { ...ReminderSelect(userId), post: { include: constructPostInclude(userId) } } }).catch((err) => console.error(err));
  if (!res) return [null, generateError('Something went wrong. Try again later.')] as const;

  const transformedReminder = transformReminder(res);
  emitReminderUpdate(userId, transformedReminder);

  return [transformedReminder, null] as const;
};
