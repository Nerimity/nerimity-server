import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { generateTurnCredentials } from '../../services/Voice';
import { generateError } from '../../common/errorHandler';

export function voiceGenerateCredentials(Router: Router) {
  Router.post(
    '/voice/generate',
    authenticate({ allowBot: true }),
    rateLimit({
      name: 'channel_voice_generate',
      restrictMS: 20000,
      requests: 3,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const result = await generateTurnCredentials();

  if (!result) {
    return res.status(403).json(generateError('Failed to generate TURN credentials'));
  }

  res.json({ result });
}
