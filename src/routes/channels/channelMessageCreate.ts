import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { MessageType } from '../../models/MessageModel';
import { createMessage } from '../../services/Message';

export function channelMessageCreate(Router: Router) {
  Router.post('/channels/:channelId/messages', 
    authenticate(),
    channelVerification(),
    body('content')
      .isString().withMessage('Content must be a string!')
      .isLength({ min: 1, max: 2000 }).withMessage('Content length must be between 1 and 2000 characters.'),
    body('socketId')
      .isString().withMessage('SocketId must be a string!')
      .isLength({ min: 1, max: 255 }).withMessage('SocketId length must be between 1 and 255 characters.'),
    route
  );
}


interface Body {
  content: string;
  socketId?: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }
  
  const message = await createMessage({
    channelId: req.channelCache._id,
    content : body.content,
    userId: req.accountCache.user._id,
    serverId: req.channelCache.server?._id,
    socketId: body.socketId,
    type: MessageType.CONTENT
  });

  res.json(message);
}