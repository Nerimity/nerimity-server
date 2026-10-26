import env from './env';

interface KlipyMedia {
  url: string;
  width: number;
  height: number;
}

interface KlipyItem {
  file: {
    hd?: { gif?: KlipyMedia };
    md?: { gif?: KlipyMedia };
    sm?: { gif?: KlipyMedia };
    xs?: { gif?: KlipyMedia };
  };
}

interface KlipyItemsResponse {
  result: boolean;
  data: {
    data: KlipyItem[];
  };
}

export async function getKlipyGif(url: string): Promise<KlipyMedia | null> {
  let gifPageUrl: URL;
  try {
    gifPageUrl = new URL(url);
  } catch {
    return null;
  }

  const slugMatch = gifPageUrl.pathname.match(/^\/gifs\/([^/]+)\/?$/);
  const slug = slugMatch?.[1];
  if (gifPageUrl.protocol !== 'https:' || gifPageUrl.hostname !== 'klipy.com' || !slug) {
    return null;
  }

  const apiUrl = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(env.KLIPY_API_KEY)}/gifs/items`);
  apiUrl.searchParams.set('slugs', slug);

  let response: globalThis.Response;
  try {
    response = await fetch(apiUrl.href);
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let json: KlipyItemsResponse;
  try {
    json = (await response.json()) as KlipyItemsResponse;
  } catch {
    return null;
  }

  if (!json?.result || !Array.isArray(json.data?.data)) return null;

  const item = json.data.data[0];
  const gif = item?.file?.hd?.gif || item?.file?.md?.gif || item?.file?.sm?.gif || item?.file?.xs?.gif;
  if (!gif || typeof gif.url !== 'string' || !Number.isFinite(gif.width) || !Number.isFinite(gif.height)) {
    return null;
  }

  return gif;
}
