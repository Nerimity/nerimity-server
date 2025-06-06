import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { getMessagesByChannelId } from '../../services/Message';
import { prisma } from '../../common/database';

export function getMessages(Router: Router) {
  Router.get('/moderation/channels/:channelId/messages', authenticate(), isModMiddleware, route);
}

async function route(req: Request, res: Response) {
  let limit = parseInt((req.query.limit || '50') as string);
  const aroundId = req.query.aroundId as string;
  const channelId = req.params.channelId as string;

  const threadMessageId = (req.query.threadMessageId as string) || undefined;

  if (limit > 50) {
    limit = 50;
  }

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { name: true, id: true, server: { select: { id: true, name: true, avatar: true } } } });
  const messages = await getMessagesByChannelId(channelId, { aroundMessageId: aroundId, limit, requesterId: req.userCache.id, threadMessageId });

  res.json({ messages, channel });
}
