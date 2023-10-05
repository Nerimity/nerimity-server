import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { body } from 'express-validator';
import { joinVoiceChannel } from '../../services/Voice';
import { CHANNEL_PERMISSIONS } from '../../common/Bitwise';
import { channelPermissions } from '../../middleware/channelPermissions';

export function channelVoiceJoin(Router: Router) {
  Router.post(
    '/channels/:channelId/voice/join',
    authenticate(),
    channelVerification(),
    channelPermissions({
      bit: CHANNEL_PERMISSIONS.JOIN_VOICE.bit,
      message: 'You are not allowed to join voice in this channel.',
    }),
    rateLimit({
      name: 'channel_voice_join',
      expireMS: 20000,
      requestCount: 10,
    }),
    body('socketId')
      .not()
      .isEmpty()
      .withMessage('socketId is required')
      .isString()
      .withMessage('socketId must be a string')
      .isLength({ min: 3, max: 320 })
      .withMessage('socketId must be between 3 and 320 characters long.'),
    route
  );
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const socketId = req.body.socketId as string;

  const [result, error] = await joinVoiceChannel(
    req.accountCache.user.id,
    socketId,
    req.channelCache.id,
    req.channelCache.serverId
  );

  if (error) {
    return res.status(403).json(error);
  }

  res.json({ success: true });
}
