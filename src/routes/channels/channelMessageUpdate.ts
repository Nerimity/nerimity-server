import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { CHANNEL_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { channelPermissions } from '../../middleware/channelPermissions';
import { channelVerification } from '../../middleware/channelVerification';
import { editMessage } from '../../services/Message/Message';
import { rateLimit } from '../../middleware/rateLimit';
import { ChannelType } from '../../types/Channel';

export function channelMessageUpdate(Router: Router) {
  Router.patch(
    '/channels/:channelId/messages/:messageId',
    authenticate({ allowBot: true }),
    channelVerification(),
    channelPermissions({
      bit: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
      message: 'You are not allowed to edit messages in this channel.',
    }),
    body('content').optional(true).isString().withMessage('Content must be a string!').isLength({ min: 1, max: 2000 }).withMessage('Content length must be between 1 and 2000 characters.'),
    body('htmlEmbed').optional(true).isString().withMessage('htmlEmbed must be a string!').isLength({ min: 1, max: 5000 }).withMessage('htmlEmbed length must be between 1 and 5000 characters.'),

    rateLimit({
      name: 'update_message',
      restrictMS: 20000,
      requests: 20,
    }),
    route
  );
}

interface Body {
  content?: string;
  htmlEmbed?: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  const messageId = req.params.messageId;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.channelCache.type === ChannelType.TICKET) {
    return res.status(400).json({ error: 'Ticket message cannot be edited.' });
  }

  if (!body.content?.trim() && !body.htmlEmbed) {
    return res.status(400).json(generateError('content or htmlEmbed is required.'));
  }

  const [updated, error] = await editMessage({
    messageId,
    channelId: req.channelCache.id,
    content: body.content,
    htmlEmbed: body.htmlEmbed,
    userId: req.userCache.id,
    channel: req.channelCache,
    serverId: req.channelCache?.server?.id,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(updated);
}
