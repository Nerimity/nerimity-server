import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { generateToken } from '@src/common/nerimityCDN';
import { generateError } from '@src/common/errorHandler';
import { channelVerification } from '@src/middleware/channelVerification';
import { hasBit, USER_BADGES } from '@src/common/Bitwise';
import { ServerCache } from '@src/cache/ServerCache';
import { ChannelType } from '@src/types/Channel';
import { nerimitySupporterCdnMessage } from '@src/common/nerimitySupporterCdnMessage';

export function ChannelCdnGenerateToken(Router: Router) {
  Router.post(
    '/channels/:channelId/cdn/token',
    authenticate(),
    channelVerification(),
    rateLimit({
      name: 'cdn_token',
      restrictMS: 30000,
      requests: 5,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const isMod = hasBit(req.userCache.badges, USER_BADGES.MOD.bit);

  const isServerNotPublicAndNotSupporter = req.serverCache && !isServerPublic(req.serverCache) && !isSupporterOrModerator(req.userCache);

  if (!isMod && isServerNotPublicAndNotSupporter) {
    return res.status(400).json(generateError(nerimitySupporterCdnMessage));
  }
  const isPrivateChannelAndNotSupporter = req.channelCache.type === ChannelType.SERVER_TEXT && !req.channelCache.canBePublic && !isSupporterOrModerator(req.userCache);

  if (!isMod && isPrivateChannelAndNotSupporter) {
    return res.status(400).json(generateError(nerimitySupporterCdnMessage));
  }

  const [genRes, error] = await generateToken({
    userId: req.userCache.id,
    channelId: req.channelCache.id,
  });
  if (error || !genRes) return res.status(400).json(generateError('Could not generate token.'));

  res.json({
    token: genRes.token,
  });
}

const isServerPublic = (server: ServerCache) => {
  return server.public;
};

const isSupporterOrModerator = (user: UserCache) => {
  return hasBit(user.badges, USER_BADGES.SUPPORTER.bit) || hasBit(user.badges, USER_BADGES.FOUNDER.bit) || hasBit(user.badges, USER_BADGES.ADMIN.bit);
};
