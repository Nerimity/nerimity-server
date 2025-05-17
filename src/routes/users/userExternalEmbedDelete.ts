import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { deleteExternalEmbed } from '../../services/User/UserManagement';
import { generateError } from '../../common/errorHandler';

export function userExternalEmbedDelete(Router: Router) {
  Router.delete(
    '/users/external-embed/',
    authenticate(),
    rateLimit({
      name: 'external_embed_delete',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [result, error] = await deleteExternalEmbed({
    userId: req.userCache.id,
  }).catch((err) => {
    console.error(err);
    return [null, generateError('Something went wrong. Try again later.')] as const;
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status: result });
}
