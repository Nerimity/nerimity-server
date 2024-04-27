import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { leaveVoiceChannel } from '../../services/Voice';

export function channelVoiceLeave(Router: Router) {
  Router.post(
    '/channels/:channelId/voice/leave',
    authenticate(),
    channelVerification(),
    rateLimit({
      name: 'channel_voice_leave',
      restrictMS: 20000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [result, error] = await leaveVoiceChannel(req.userCache.id);

  if (error) {
    return res.status(403).json(error);
  }

  res.json({ success: true });
}
