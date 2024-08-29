import { NextFunction, Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { CHANNEL_PERMISSIONS, ROLE_PERMISSIONS, USER_BADGES, hasBit, isUserAdmin } from '../../common/Bitwise';
import { authenticate } from '../../middleware/authenticate';
import { channelPermissions } from '../../middleware/channelPermissions';
import { channelVerification } from '../../middleware/channelVerification';
import { MessageType } from '../../types/Message';
import { AttachmentProviders, createMessage } from '../../services/Message';
import { memberHasRolePermission, memberHasRolePermissionMiddleware } from '../../middleware/memberHasRolePermission';
import { rateLimit } from '../../middleware/rateLimit';
import { deleteImage, uploadImage } from '../../common/nerimityCDN';
import { connectBusboyWrapper } from '../../middleware/connectBusboyWrapper';
import { ChannelType, TextChannelTypes } from '../../types/Channel';
import { Attachment } from '@prisma/client';
import { dateToDateTime, prisma } from '../../common/database';
import { ChannelCache } from '../../cache/ChannelCache';
import { UserCache } from '../../cache/UserCache';
import { ServerCache } from '../../cache/ServerCache';
import { CloseTicketStatuses, TicketStatus, updateTicketStatus } from '../../services/Ticket';
import { banServerMember } from '../../services/Server';
import { AltQueue, Queue } from '@nerimity/mimiqueue';
import { redisClient } from '../../common/redis';
import { checkAndUpdateRateLimit } from '../../cache/RateLimitCache';
import { ServerMemberCache } from '../../cache/ServerMemberCache';

export function channelMessageCreate(Router: Router) {
  Router.post(
    '/channels/:channelId/messages',
    authenticate({ allowBot: true }),
    channelVerification(),
    channelPermissions({
      bit: CHANNEL_PERMISSIONS.SEND_MESSAGE.bit,
      message: 'You are not allowed to send messages in this channel.',
    }),
    memberHasRolePermissionMiddleware(ROLE_PERMISSIONS.SEND_MESSAGE),
    connectBusboyWrapper,
    body('content').optional(true).isString().withMessage('Content must be a string!').isLength({ min: 1, max: 2000 }).withMessage('Content length must be between 1 and 2000 characters.'),
    body('socketId').optional(true).isString().withMessage('SocketId must be a string!').isLength({ min: 1, max: 255 }).withMessage('SocketId length must be between 1 and 255 characters.'),

    body('replyToMessageIds')
      .optional(true)
      .isArray()
      .withMessage('replyToMessageIds must be an array of strings!')
      .custom((value) => {
        return value.length <= 5;
      })
      .withMessage('replyToMessageIds length must be less than or equal to 5 strings.'),

    body('replyToMessageIds.*').optional(true).isString().withMessage('replyToMessageIds must be an array of strings!'),

    body('mentionReplies').optional(true).isBoolean().withMessage('mentionReplies must be a boolean!'),

    body('googleDriveAttachment').optional(true).isObject().withMessage('googleDriveFile must be an object!'),

    body('htmlEmbed').optional(true).isString().withMessage('htmlEmbed must be a string!').isLength({ min: 1, max: 5000 }).withMessage('htmlEmbed length must be between 1 and 5000 characters.'),

    body('googleDriveAttachment.id').optional(true).isString().withMessage('googleDriveAttachment id must be a string!').isLength({ min: 1, max: 255 }).withMessage('googleDriveAttachment id length must be between 1 and 255 characters.'),

    body('googleDriveAttachment.mime').optional(true).isString().withMessage('googleDriveAttachment mime must be a string!').isLength({ min: 1, max: 255 }).withMessage('googleDriveAttachment mime length must be between 1 and 255 characters.'),

    body('buttons')
      .optional(true)
      .isArray()
      .withMessage('buttons must be an array of objects!')
      .custom((value) => {
        return value.length <= 8;
      })
      .withMessage('buttons length must be less than or equal to 8 objects.'),

    body('buttons.*').optional(true).isObject().withMessage('buttons must be an array of objects!'),

    body('buttons.*.label').isString().withMessage('buttons label must be a string!').isLength({ min: 1, max: 64 }).withMessage('button label length must be between 1 and 64 characters.'),

    body('buttons.*.id').isAlphanumeric().withMessage('buttons id must be a string!').isLength({ min: 1, max: 64 }).withMessage('button id length must be between 1 and 64 characters.'),
    body('buttons.*.alert').optional(true).isBoolean().withMessage('buttons alert must be a boolean!'),

    rateLimit({
      name: 'create_message',
      restrictMS: 20000,
      requests: 20,
      itterId: (req: Request) => req.channelCache.id,
      onThreeIterations: async (req) => {
        const isServerChannel = req.channelCache.type === ChannelType.SERVER_TEXT;
        if (!isServerChannel) return;

        const isServerOwner = req.userCache.id === req.serverCache.createdById;
        if (isServerOwner) return;

        await banServerMember(req.userCache.id, req.serverCache.id, true);
      },
    }),
    queueRoute
  );
}

const queue = new AltQueue({
  name: 'create_message',
  redisClient,
});

const queueRoute = async (req: Request, res: Response) => {
  const finish = await queue.start({ groupName: req.userIP });
  route(req, res).finally(() => finish());
};

interface Body {
  content?: string;
  socketId?: string;
  htmlEmbed?: string;
  replyToMessageIds?: string[];
  mentionReplies?: boolean;
  googleDriveAttachment?: {
    id: string;
    mime: string;
  };
  buttons?: { label: string; id: string; alert?: boolean }[];
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  if (req.channelCache.type === ChannelType.SERVER_TEXT && req.channelCache.slowModeSeconds && !isServerMemberModerator(req.serverCache, req.serverMemberCache)) {
    const ttl = await checkAndUpdateRateLimit({
      id: `${req.userCache.id}-${req.channelCache.id}`,
      perMS: req.channelCache.slowModeSeconds * 1000,
      restrictMS: req.channelCache.slowModeSeconds * 1000,
      requests: 1,
    });

    if (ttl) {
      return res.status(429).json({ ...generateError('Slow down!'), ttl });
    }
  }

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.channelCache.type === ChannelType.TICKET) {
    const status = req.channelCache.ticket.status;
    const isTicketClosed = CloseTicketStatuses.includes(status);
    const checkUserAdmin = isUserAdmin(req.userCache.badges);

    if (isTicketClosed && !checkUserAdmin) {
      return res.status(400).json(generateError('This ticket is closed'));
    }

    const messageCount = await prisma.message.count({
      where: { channelId: req.channelCache.id },
      take: 50,
    });

    if (messageCount >= 50) {
      await updateTicketStatus({
        ticketId: req.channelCache.ticket.id,
        status: TicketStatus.CLOSED_AS_DONE,
      });
      return res.status(400).json(generateError('This ticket is closed'));
    }
  }

  const hasAttachment = body.googleDriveAttachment || req.fileInfo?.file;

  if (hasAttachment) {
    if (!isEmailConfirmed(req.userCache)) {
      return res.status(400).json(generateError('You must confirm your email to send attachment messages.'));
    }

    const isServerNotPublicAndNotSupporter = req.serverCache && !isServerPublic(req.serverCache) && !isSupporterOrModerator(req.userCache);

    if (isServerNotPublicAndNotSupporter) {
      return res.status(400).json(generateError('You must be a Nerimity supporter to send attachment messages to a private server.'));
    }
    const isPrivateChannelAndNotSupporter = isPrivateChannel(req.channelCache) && !isSupporterOrModerator(req.userCache);

    if (isPrivateChannelAndNotSupporter) {
      return res.status(400).json(generateError('You must be a Nerimity supporter to send attachment messages to a private channel.'));
    }
  }

  if (body.googleDriveAttachment) {
    if (!body.googleDriveAttachment.id) return res.status(400).json(generateError('googleDriveAttachment id is required'));
    if (!body.googleDriveAttachment.mime) return res.status(400).json(generateError('googleDriveAttachment mime is required'));
  }

  const isServerChannel = req.channelCache.type === ChannelType.SERVER_TEXT || req.channelCache.type === ChannelType.CATEGORY;

  if (!req.userCache.application && isServerChannel && !req.userCache.account.emailConfirmed) {
    return res.status(400).json(generateError('You must confirm your email to send messages.'));
  }

  if (req.channelCache.type === ChannelType.DM_TEXT && !req.channelCache?.inbox) {
    return res.status(400).json(generateError('You must open the DM channel first.'));
  }

  if (req.channelCache.type === ChannelType.DM_TEXT && !req.channelCache.inbox.canMessage) {
    return res.status(400).json(generateError('You cannot message this user.'));
  }

  if (!TextChannelTypes.includes(req.channelCache.type)) {
    return res.status(400).json(generateError('You cannot send messages in this channel.'));
  }

  if (!body.content?.trim() && !req.fileInfo?.file && !body.googleDriveAttachment) {
    return res.status(400).json(generateError('content or attachment is required.'));
  }

  let canMentionEveryone = body.content?.includes('[@:e]');
  if (canMentionEveryone) {
    const [hasMentionEveryonePerm] = memberHasRolePermission(req, ROLE_PERMISSIONS.MENTION_EVERYONE);
    canMentionEveryone = !!hasMentionEveryonePerm;
  }

  let attachment: Partial<Attachment> | undefined = undefined;

  if (req.fileInfo?.file) {
    const [uploadedImage, err] = await uploadImage(req.fileInfo?.file, req.fileInfo.info.filename, req.channelCache.id);

    if (err) {
      if (typeof err === 'string') {
        return res.status(403).json(generateError(err));
      }
      if (err.type === 'INVALID_IMAGE') {
        return res.status(403).json(generateError('You can only upload images for now.'));
      }
      return res.status(403).json(generateError(`An unknown error has occurred (${err.type})`));
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
      createdAt: dateToDateTime() as unknown as Date,
    };
  }

  const [message, error] = await createMessage({
    channelId: req.channelCache.id,
    content: body.content,
    userId: req.userCache.id,
    channel: req.channelCache,
    serverId: req.channelCache?.server?.id,
    replyToMessageIds: body.replyToMessageIds,
    mentionReplies: body.mentionReplies,
    server: req.serverCache,
    socketId: body.socketId,
    type: MessageType.CONTENT,
    attachment,
    everyoneMentioned: canMentionEveryone,
    htmlEmbed: body.htmlEmbed,
    buttons: body.buttons?.map(({ id, label, alert }) => ({ id, label, alert })),
  });

  if (error) {
    if (req.fileInfo?.file && attachment?.path) {
      deleteImage(attachment.path);
    }
    return res.status(400).json(generateError(error));
  }

  res.json(message);
}

const isEmailConfirmed = (user: UserCache) => {
  return user.account?.emailConfirmed;
};

const isSupporterOrModerator = (user: UserCache) => {
  return hasBit(user.badges, USER_BADGES.SUPPORTER.bit) || hasBit(user.badges, USER_BADGES.FOUNDER.bit) || hasBit(user.badges, USER_BADGES.ADMIN.bit);
};

const isPrivateChannel = (channel: ChannelCache) => {
  if (!channel.serverId) return false;
  return hasBit(channel.permissions, CHANNEL_PERMISSIONS.PRIVATE_CHANNEL.bit);
};

const isServerPublic = (server: ServerCache) => {
  return server.public;
};

const isServerMemberModerator = (server: ServerCache, member: ServerMemberCache) => {
  if (server.createdById === member.userId) return true;
  return hasBit(member.permissions, ROLE_PERMISSIONS.ADMIN.bit);
};
