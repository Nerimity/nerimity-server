import { Request, Response, Router } from 'express';
import { rateLimit } from '../../middleware/rateLimit';
import { ExternalEmbedType, getExternalEmbed } from '../../services/User/UserManagement';
import { generateError } from '../../common/errorHandler';

export function serverExternalEmbedGet(Router: Router) {
  Router.get(
    '/servers/:serverId/external-embed.json',
    rateLimit({
      name: 'external_embed_get',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}
const thirtyMinutesInSeconds = 30 * 60;

async function route(req: Request, res: Response) {
  const id = req.params.serverId;

  const [result, error] = await getExternalEmbed({
    serverId: id,
  }).catch((err) => {
    console.error(err);
    return [null, generateError('Something went wrong. Try again later.')] as const;
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.setHeader('Cache-Control', `public, max-age=${thirtyMinutesInSeconds}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.write(JSON.stringify(result));
  res.end();
}
