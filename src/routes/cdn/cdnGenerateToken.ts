import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { generateToken } from '@src/common/nerimityCDN';
import { generateError } from '@src/common/errorHandler';

export function cdnGenerateToken(Router: Router) {
  Router.post(
    '/cdn/token',
    authenticate({ allowBot: true }),
    rateLimit({
      name: 'cdn_token',
      restrictMS: 30000,
      requests: 5,
    }),
    route,
  );
}

async function route(req: Request, res: Response) {
  const [genRes, error] = await generateToken({
    userId: req.userCache.id,
  });
  if (error || !genRes) return res.status(400).json(generateError('Could not generate token.'));

  res.json({
    token: genRes.token,
  });
}
