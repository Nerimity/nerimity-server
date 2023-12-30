import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import env from '../../common/env';

export function getTenorCategories(Router: Router) {
  Router.get(
    '/tenor/categories',
    authenticate(),
    rateLimit({
      name: 'tenor-categories',
      expireMS: 60000,
      requestCount: 20,
    }),
    route
  );
}

interface TenorResponse {
  tags: TenorCategory[];
  locale: string;
}

interface TenorCategory {
  searchterm: string; // 'anime smile',
  path: string; // '/v2/search?q=anime%20smile&locale=en&component=categories&contentfilter=high',
  image: string; // 'https://media.tenor.com/KASKTaO4YvsAAAAM/my-dress-up-darling-anime-smile.gif',
  name: string; // '#anime smile'
}

let cache: TenorCategory[] | null = null;

const ONE_HOUR_TO_MS = 3600000;

setInterval(() => {
  cache = null;
}, ONE_HOUR_TO_MS);

async function route(req: Request, res: Response) {
  if (cache) return res.json(cache);

  const url = new URL('https://tenor.googleapis.com/v2/categories');

  url.searchParams.set('type', 'trending');
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

  cache = json.tags;

  res.json(json.tags);
}
