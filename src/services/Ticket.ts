import { updateTicketChannelStatus } from '../cache/ChannelCache';
import { dateToDateTime, prisma } from '../common/database';
import { generateId } from '../common/flakeId';
import { ChannelType } from '../types/Channel';
import { MessageType } from '../types/Message';
import { createMessage } from './Message/Message';

export enum TicketCategory {
  QUESTION = 0,
  ACCOUNT = 1,
  ABUSE = 2,
  OTHER = 3,
  SERVER_VERIFICATION = 4,
}

export enum TicketStatus {
  WAITING_FOR_MODERATOR_RESPONSE = 0,
  WAITING_FOR_USER_RESPONSE = 1,
  CLOSED_AS_DONE = 2,
  CLOSED_AS_INVALID = 3,
}

export const CloseTicketStatuses = [TicketStatus.CLOSED_AS_DONE, TicketStatus.CLOSED_AS_INVALID];

interface CreateTicketOpts {
  title: string;
  category: TicketCategory;
  body: string;
  requestedById: string;
}

export const createTicket = async (opts: CreateTicketOpts) => {
  // check if category is valid
  if (!Object.values(TicketCategory).includes(opts.category)) {
    return [null, 'Invalid category'] as const;
  }

  const newChannel = await prisma.channel.create({
    data: {
      id: generateId(),
      type: ChannelType.TICKET,
      createdById: opts.requestedById,
      ticket: {
        create: {
          status: TicketStatus.WAITING_FOR_MODERATOR_RESPONSE,
          category: opts.category,
          title: opts.title,
          openedById: opts.requestedById,
        },
      },
    },
    include: {
      ticket: true,
    },
  });

  await createMessage({
    channelId: newChannel.id,
    type: MessageType.CONTENT,
    userId: opts.requestedById,
    content: opts.body,
  });

  return [newChannel.ticket, null] as const;
};

export const getOwnTickets = async (userId: string, opts?: { status?: TicketStatus; limit?: number; seen?: boolean }) => {
  const tickets = await prisma.ticket.findMany({
    where: {
      openedById: userId,
      ...(opts?.status !== undefined ? { status: opts?.status } : undefined),
      ...(opts?.seen !== undefined ? { seen: opts?.seen } : undefined),
    },
    orderBy: { lastUpdatedAt: 'desc' },
    take: opts?.limit || 30,
    select: {
      id: true,
      status: true,
      category: true,
      title: true,
      openedAt: true,
      channelId: true,
      lastUpdatedAt: true,
      seen: true,
    },
  });
  return tickets;
};

export const updateTicketStatus = async (opts: { ticketId: number; status: TicketStatus; userId?: string }) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: opts.ticketId },
    select: {
      status: true,
      id: true,
      openedById: true,
    },
  });

  if (!ticket) {
    return [null, 'Ticket not found'] as const;
  }

  // if opts.userId is not provided, it means that the requester is a moderator.
  if (opts.userId) {
    if (ticket.openedById !== opts.userId) {
      return [null, 'Unauthorized'] as const;
    }

    if (CloseTicketStatuses.includes(ticket.status)) {
      return [null, 'Ticket is closed'] as const;
    }
  }

  const newTicket = await prisma.ticket.update({
    where: { id: opts.ticketId },
    data: { status: opts.status, lastUpdatedAt: dateToDateTime() },
    select: {
      id: true,
      status: true,
      category: true,
      title: true,
      openedAt: true,
      channelId: true,
      lastUpdatedAt: true,
      openedBy: opts.userId ? false : true,
    },
  });
  await updateTicketChannelStatus(newTicket.channelId, opts.status);

  return [newTicket, null] as const;
};

export const getTicketById = async (ticketId: string, userId: string) => {
  const ticket = await prisma.ticket.findFirst({
    where: { openedById: userId, id: parseInt(ticketId) },
    select: {
      id: true,
      status: true,
      category: true,
      title: true,
      openedAt: true,
      channelId: true,
      lastUpdatedAt: true,
      seen: true,
    },
  });

  if (!ticket) {
    return null;
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { seen: true },
  });

  return ticket;
};
