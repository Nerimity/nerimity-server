import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getMessagesByChannelId } from '../../services/Message';
import { generateError } from '../../common/errorHandler';
import { ChannelType } from '../../types/Channel';
import { ExternalMessage, ExternalMessages, fetchFromExternalIo } from '../../external-server-channel-socket/externalServerChannelSocket';
import { prisma } from '../../common/database';
import { type } from 'arktype';
import { removeDuplicates } from '../../common/utils';

export function channelMessages(Router: Router) {
  Router.get(
    '/channels/:channelId/messages',
    authenticate({ allowBot: true }),
    channelVerification(),
    rateLimit({
      name: 'messages',
      restrictMS: 30000,
      requests: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const limit = parseInt((req.query.limit as string) || '50') || undefined;
  const after = (req.query.after as string) || undefined;
  const before = (req.query.before as string) || undefined;
  const around = (req.query.around as string) || undefined;

  if (req.channelCache.type === ChannelType.CATEGORY) {
    return res.status(400).json(generateError('Cannot get messages from a category channel'));
  }

  const t1 = performance.now();

  if (req.channelCache.type === ChannelType.SERVER_TEXT && req.channelCache.external) {
    const [result, err] = await fetchFromExternalIo(req.channelCache.id, { name: 'get_messages', limit, after, before, around });
    if (err) {
      console.log(err);
      return res.status(400).json(generateError("Couldn't fetch messages from external server."));
    }

    const messages = ExternalMessages(result);

    if (messages instanceof type.errors) {
      console.log(result);
      console.log(messages.summary);
      return res.status(400).json(generateError('Invalid messages from external server.'));
    }

    const userIds = removeDuplicates([...messages.map((m) => m.createdById), ...messages.map((m) => m.mentions).flat()]);

    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, tag: true, hexColor: true, avatar: true, badges: true, bot: true } });

    const newMessages = messages.map((m) => ({
      ...m,
      createdBy: users.find((u) => m.createdById === u.id),
      mentions: users.filter((u) => m.mentions.includes(u.id)),
    }));

    return res.json(newMessages);
  }

  const messages = await getMessagesByChannelId(req.channelCache.id, {
    limit,
    afterMessageId: after,
    beforeMessageId: before,
    aroundMessageId: around,
    requesterId: req.userCache.id,
  });

  res.setHeader('T-msg-took', (performance.now() - t1).toFixed(2) + 'ms');
  res.json(messages);
}
