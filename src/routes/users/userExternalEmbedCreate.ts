import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { createExternalEmbed, ExternalEmbedType } from '../../services/User/UserManagement';
import { generateError } from '../../common/errorHandler';

export function userExternalEmbedCreate(Router: Router) {
  Router.post(
    '/users/external-embed',
    authenticate(),
    rateLimit({
      name: 'external_embed',
      restrictMS: 60000,
      requests: 4,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [result, error] = await createExternalEmbed({
    userId: req.userCache.id,
    type: ExternalEmbedType.USER,
  }).catch((err) => {
    console.error(err);
    return [null, generateError('Something went wrong. Try again later.')] as const;
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ id: result.id });
}
