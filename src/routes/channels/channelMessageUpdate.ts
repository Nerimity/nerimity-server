import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { CHANNEL_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { channelPermissions } from '../../middleware/channelPermissions';
import { channelVerification } from '../../middleware/channelVerification';
import { editMessage } from '../../services/Message';
import { rateLimit } from '../../middleware/rateLimit';

export function channelMessageUpdate(Router: Router) {
  Router.patch('/channels/:channelId/messages/:messageId', 
    authenticate(),
    channelVerification(),
    channelPermissions({bit: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit, message: 'You are not allowed to edit messages in this channel.'}),
    body('content')
      .isString().withMessage('Content must be a string!')
      .isLength({ min: 1, max: 2000 }).withMessage('Content length must be between 1 and 2000 characters.'),
    rateLimit({
      name: 'update_message',
      expireMS: 20000,
      requestCount: 20,
    }),
    route
  );
}


interface Body {
  content: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;
  const messageId = req.params.messageId;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }
  
  const [updated, error] = await editMessage({
    messageId,
    channelId: req.channelCache.id,
    content: body.content,
    userId: req.accountCache.user.id,
    channel: req.channelCache,
    serverId: req.channelCache?.server?.id,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(updated);
}