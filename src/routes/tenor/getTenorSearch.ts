import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import env from '../../common/env';

export function getTenorSearch(Router: Router) {
  Router.get(
    '/tenor/search',
    authenticate(),
    rateLimit({
      name: 'tenor-search',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
  Router.get(
    '/v2/tenor/search',
    authenticate(),
    rateLimit({
      name: 'tenor-search',
      restrictMS: 60000,
      requests: 20,
    }),
    route
  );
}

interface TenorResponse {
  next: string;
  results: TenorItem[];
}

interface TenorItem {
  id: string;
  title: string;
  media_formats: {
    gif?: {
      url: string;
      dims: [number, number];
    };
    tinygif?: {
      url: string;
      dims: [number, number];
    };
  };
  created: number;
  content_description: string;
  itemurl: string;
  url: string;
  tags: string[];
  flags: any[];
  hasaudio: boolean;
}

async function route(req: Request, res: Response) {
  const query = req.query.query as string;
  const pos = req.query.pos as string;

  const url = new URL('https://api.klipy.com/v2/search');

  url.searchParams.set('q', query);
  url.searchParams.set('contentfilter', 'medium');
  if (pos) {
    url.searchParams.set('pos', pos);
  }

  url.searchParams.append('key', env.KLIPY_API_KEY);

  const fetchRes = await fetch(url.href).catch(() => {});
  if (!fetchRes) {
    res.status(403).send();
    return;
  }

  const json = (await fetchRes.json().catch(() => {})) as TenorResponse;

  if (!json) {
    res.status(403).send();
    return;
  }

  const transformedResults = json?.results
    ?.filter((item: TenorItem) => {
      return item.media_formats.gif || item.media_formats.tinygif;
    })
    ?.map((item: TenorItem) => ({
      url: item.itemurl,
      previewUrl: item.media_formats.tinygif?.url || item.media_formats.gif?.url,
      previewWidth: item.media_formats.tinygif?.dims[0] || item.media_formats.gif?.dims[0],
      previewHeight: item.media_formats.tinygif?.dims[1] || item.media_formats.gif?.dims[1],
    }));

  if (!transformedResults) {
    res.status(403).send();
    return;
  }

  if (req.path.startsWith('/v2')) {
    res.json({
      next: json.next,
      results: transformedResults,
    });
    return;
  }

  res.json(transformedResults);
}
