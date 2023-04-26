import { NextFunction, Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { channelPermissions } from '../../middleware/channelPermissions';
import { channelVerification } from '../../middleware/channelVerification';
import { MessageType } from '../../types/Message';
import { createMessage } from '../../services/Message';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { uploadImage } from '../../common/nerimityCDN';
import { connectBusboyWrapper } from '../../middleware/connectBusboyWrapper';
import z from 'zod';


const bodySchema = z.object({
  content: z.string().optional().max,
  
});


export function channelMessageCreate(Router: Router) {
  Router.post('/channels/:channelId/messages', 
    authenticate(),
    channelVerification(),
    channelPermissions({bit: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit, message: 'You are not allowed to send messages in this channel.'}),
    memberHasRolePermission(ROLE_PERMISSIONS.SEND_MESSAGE),
    connectBusboyWrapper,



    body('content')
      .optional(true)
      .isString().withMessage('Content must be a string!')
      .isLength({ min: 1, max: 2000 }).withMessage('Content length must be between 1 and 2000 characters.'),
    body('socketId')
      .optional(true)
      .isString().withMessage('SocketId must be a string!')
      .isLength({ min: 1, max: 255 }).withMessage('SocketId length must be between 1 and 255 characters.'),



    rateLimit({
      name: 'create_message',
      expireMS: 20000,
      requestCount: 20,
    }),
    route
  );
}


interface Body {
  content?: string;
  socketId?: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!body.content?.trim() && !req.fileInfo?.file) {
    return res.status(400).json(generateError('content or attachment is required.'));
  }

  let attachment: { width?: number; height?: number; path: string} | undefined = undefined;

  if (req.fileInfo?.file) {
    const [uploadedImage, err] = await uploadImage(req.fileInfo?.file, req.fileInfo.info.filename, req.channelCache.id);
    if (uploadedImage) {
      attachment = {
        width: uploadedImage.dimensions.width,
        height: uploadedImage.dimensions.height,
        path: uploadedImage.path
      };
    }
  }

  
  const message = await createMessage({
    channelId: req.channelCache.id,
    content: body.content,
    userId: req.accountCache.user.id,
    channel: req.channelCache,
    serverId: req.channelCache?.server?.id,
    socketId: body.socketId,
    type: MessageType.CONTENT,
    attachment
  });

  res.json(message);
}