import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import env from '../../common/env';

export function getTenorTrending(Router: Router) {
  Router.get(
    '/v2/tenor/trending',
    authenticate(),
    rateLimit({
      name: 'tenor-trending',
      restrictMS: 60000,
      requests: 20,
    }),
    route,
  );
}

interface KlipyMedia {
  url: string;
  width: number;
  height: number;
}

interface KlipyTrendingItem {
  slug: string;
  file: {
    hd?: { gif?: KlipyMedia };
    md?: { gif?: KlipyMedia };
    sm?: { gif?: KlipyMedia };
    xs?: { gif?: KlipyMedia };
  };
}

interface KlipyTrendingResponse {
  result: boolean;
  data: {
    data: KlipyTrendingItem[];
    current_page: number;
    has_next: boolean;
  };
}



async function route(req: Request, res: Response) {
  const pos = req.query.pos as string;



  const url = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(env.KLIPY_API_KEY)}/gifs/trending`);
  if (pos) {
    url.searchParams.set('page', pos);
  }
  url.searchParams.set('contentfilter', 'medium');
  url.searchParams.set('format_filter', 'gif');

  let fetchRes: globalThis.Response;
  try {
    fetchRes = await fetch(url.href);
  } catch {
    res.status(502).send();
    return;
  }

  if (!fetchRes.ok) {
    res.status(502).send();
    return;
  }

  let json: KlipyTrendingResponse;
  try {
    json = (await fetchRes.json()) as KlipyTrendingResponse;
  } catch {
    res.status(502).send();
    return;
  }

  if (
    !json?.result ||
    !Array.isArray(json.data?.data) ||
    !Number.isSafeInteger(json.data.current_page) ||
    typeof json.data.has_next !== 'boolean'
  ) {
    res.status(502).send();
    return;
  }

  const results = json.data.data.map((item) => {
    const gif = item.file.md?.gif || item.file.sm?.gif || item.file.hd?.gif || item.file.xs?.gif;
    const preview = item.file.sm?.gif || item.file.xs?.gif || gif;

    if (!gif || !preview) {
      return null;
    }

    return {
      url: `https://klipy.com/gifs/${encodeURIComponent(item.slug)}`,
      gifUrl: gif.url,
      previewUrl: preview.url,
      previewWidth: preview.width,
      previewHeight: preview.height,
    };
  });

  if (results.some((item) => item === null)) {
    res.status(502).send();
    return;
  }

  res.json({
    next: json.data.has_next ? String(json.data.current_page + 1) : '',
    results,
  });
}
