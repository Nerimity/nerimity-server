import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';
import { getRawExternalEmbed } from '../../services/User/UserManagement';
import { generateError } from '../../common/errorHandler';

export function serverExternalEmbedRawGet(Router: Router) {
  Router.get(
    '/servers/:serverId/external-embed',
    rateLimit({
      name: 'external_embed_get',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const id = req.params.serverId;

  const [result, error] = await getRawExternalEmbed({
    serverId: id,
  }).catch((err) => {
    console.error(err);
    return [null, generateError('Something went wrong. Try again later.')] as const;
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}
