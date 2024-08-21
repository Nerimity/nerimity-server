import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { getAttachments } from '../../services/Attachment';

export function channelAttachments(Router: Router) {
  Router.get(
    '/channels/:channelId/attachments',
    authenticate(),
    channelVerification(),
    rateLimit({
      name: 'channel_attachments',
      restrictMS: 30000,
      requests: 50,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  let limit = parseInt((req.query.limit as string) || '50') || undefined;
  const after = (req.query.after as string) || undefined;
  const before = (req.query.before as string) || undefined;

  if (limit && limit < 0) {
    limit = 50;
  }

  const messages = await getAttachments({
    channelId: req.channelCache.id,
    afterAttachmentId: after,
    beforeAttachmentId: before,
    limit,
  });
  res.json(messages);
}
