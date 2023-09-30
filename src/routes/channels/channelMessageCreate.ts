import { NextFunction, Request, Response, Router } from 'express';
import { body } from 'express-validator';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { channelPermissions } from '../../middleware/channelPermissions';
import { channelVerification } from '../../middleware/channelVerification';
import { MessageType } from '../../types/Message';
import { AttachmentProviders, createMessage } from '../../services/Message';
import { memberHasRolePermission } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { uploadImage } from '../../common/nerimityCDN';
import { connectBusboyWrapper } from '../../middleware/connectBusboyWrapper';
import { ChannelType, TextChannelTypes } from '../../types/Channel';
import { DmStatus } from '../../services/User';
import { Attachment } from '@prisma/client';
import { dateToDateTime } from '../../common/database';

export function channelMessageCreate(Router: Router) {
  Router.post(
    '/channels/:channelId/messages',
    authenticate(),
    channelVerification(),
    channelPermissions({
      bit: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
      message: 'You are not allowed to send messages in this channel.',
    }),
    memberHasRolePermission(ROLE_PERMISSIONS.SEND_MESSAGE),
    connectBusboyWrapper,
    body('content')
      .optional(true)
      .isString()
      .withMessage('Content must be a string!')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Content length must be between 1 and 2000 characters.'),
    body('socketId')
      .optional(true)
      .isString()
      .withMessage('SocketId must be a string!')
      .isLength({ min: 1, max: 255 })
      .withMessage('SocketId length must be between 1 and 255 characters.'),

    body('googleDriveAttachment')
      .optional(true)
      .isObject()
      .withMessage('googleDriveFile must be an object!'),

    body('googleDriveAttachment.id')
      .optional(true)
      .isString()
      .withMessage('googleDriveAttachment id must be a string!')
      .isLength({ min: 1, max: 255 })
      .withMessage('googleDriveAttachment id length must be between 1 and 255 characters.'),

    body('googleDriveAttachment.mime')
      .optional(true)
      .isString()
      .withMessage('googleDriveAttachment mime must be a string!')
      .isLength({ min: 1, max: 255 })
      .withMessage('googleDriveAttachment mime length must be between 1 and 255 characters.'),



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
  googleDriveAttachment?: {
    id: string;
    mime: string;
  };
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (body.googleDriveAttachment) {
    if (!body.googleDriveAttachment.id) return res.status(400).json(generateError('googleDriveAttachment id is required'));
    if (!body.googleDriveAttachment.mime) return res.status(400).json(generateError('googleDriveAttachment mime is required'));
  }

  if (req.channelCache.serverId && !req.accountCache.emailConfirmed) {
    return res
      .status(400)
      .json(generateError('You must confirm your email to send messages.'));
  }

  if (req.channelCache.inbox && !req.channelCache.inbox.canMessage) {
    return res.status(400).json(generateError('You cannot message this user.'));
  }

  if (!TextChannelTypes.includes(req.channelCache.type)) {
    return res
      .status(400)
      .json(generateError('You cannot send messages in this channel.'));
  }

  if (!body.content?.trim() && !req.fileInfo?.file && !body.googleDriveAttachment) {
    return res
      .status(400)
      .json(generateError('content or attachment is required.'));
  }

  let attachment: Partial<Attachment> | undefined = undefined;

  if (req.fileInfo?.file) {
    const [uploadedImage, err] = await uploadImage(
      req.fileInfo?.file,
      req.fileInfo.info.filename,
      req.channelCache.id
    );

    if (err) {
      if (typeof err === 'string') {
        return res.status(403).json(generateError(err));
      }
      if (err.type === 'INVALID_IMAGE') {
        return res
          .status(403)
          .json(generateError('You can only upload images for now.'));
      }
      return res
        .status(403)
        .json(generateError(`An unknown error has occurred (${err.type})`));
    }

    attachment = {
      width: uploadedImage!.dimensions.width,
      height: uploadedImage!.dimensions.height,
      path: uploadedImage!.path,
    };
  }

  if (body.googleDriveAttachment) {
    attachment = {
      fileId: body.googleDriveAttachment.id,
      mime: body.googleDriveAttachment.mime,
      provider: AttachmentProviders.GoogleDrive,
      createdAt: dateToDateTime() as unknown as Date
    };
  }

  const message = await createMessage({
    channelId: req.channelCache.id,
    content: body.content,
    userId: req.accountCache.user.id,
    channel: req.channelCache,
    serverId: req.channelCache?.server?.id,
    server: req.serverCache,
    socketId: body.socketId,
    type: MessageType.CONTENT,
    attachment,
  });

  res.json(message);
}
