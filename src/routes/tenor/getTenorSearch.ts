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
      expireMS: 60000,
      requestCount: 20,
    }),
    route
  );
}

interface TenorResponse {
  next: string;
  results: TenorItem[];
}

interface TenorItem {
  id: string
  title: string
  media_formats: Record<string, any>;
  created: number
  content_description: string
  itemurl: string
  url: string
  tags: string[]
  flags: any[]
  hasaudio: boolean
}

async function route(req: Request, res: Response) {
  const query = req.query.query as string;
 

  const url = new URL('https://tenor.googleapis.com/v2/search');

  url.searchParams.set('q', query);
  url.searchParams.set('contentfilter', 'high');

  url.searchParams.append('key', env.TENOR_API_KEY);

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

  const transformedResults = json.results.map((item: TenorItem) => item.itemurl);
  
  res.json(transformedResults);
}
