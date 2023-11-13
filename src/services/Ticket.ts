import { prisma } from '../common/database';
import { generateId } from '../common/flakeId';
import { ChannelType } from '../types/Channel';

export const AllowedCategories = [
  'QUESTION',
  'ACCOUNT',
  'ABUSE',
  'OTHER',
] as const;

interface CreateTicketOpts {
  title: string;
  category: (typeof AllowedCategories)[number];
  description: string;
  requestedById: string;
}

export const createTicket = async (opts: CreateTicketOpts) => {
  const newChannel = await prisma.channel.create({
    data: {
      id: generateId(),
      type: ChannelType.TICKET,
      createdById: opts.requestedById,
      ticket: {
        create: {
          id: generateId(),
          category: opts.category,
          title: opts.title,
          openedById: opts.requestedById,
        },
      },
    },
  });

  return newChannel;
};
