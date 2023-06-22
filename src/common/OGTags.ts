import fetch, { Response } from 'node-fetch';
import { parse } from 'node-html-parser';
import { proxyUrlImageDimensions } from './nerimityCDN';

const mapper = new Map(
  Object.entries({
    site_name: 'siteName',
    type: 'type',
    title: 'title',
    url: 'url',
    description: 'description',
    image: 'imageUrl',
    'image:width': 'imageWidth',
    'image:height': 'imageHeight',
  })
);

type GetOGTagsReturn = Promise<false | Record<string, string | number>>;

export async function getOGTags(url: string): GetOGTagsReturn {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 NerimityBot' },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  }).catch(() => {});
  if (!res) return false;

  const isImage = res.headers.get('content-type')?.startsWith('image/');
  if (isImage) {
    return await getImageEmbed(url);
  }

  const isHtml = res.headers.get('content-type')?.startsWith('text/html');
  if (!isHtml) return false;

  const html = await res.text();
  const root = parse(html);
  const metaTags = root.querySelectorAll('head meta');

  const filteredOGTags = metaTags.filter((el) => {
    const isOG = el.attributes.property?.startsWith('og:');
    const isValidField = mapper.has(el.attributes.property?.split('og:')?.[1]);
    return isOG && isValidField;
  });

  const entries = filteredOGTags.map((el) => [
    mapper.get(el.attributes.property.split('og:')[1]),
    el.attributes.content.substring(0, 1000),
  ]);
  if (!entries.length) return false;

  const object = Object.fromEntries(entries);
  object.url = addProtocolToUrl(object.url || url);

  if (object.imageUrl) {
    object.imageMime = (await fetch(object.imageUrl)).headers.get(
      'content-type'
    );
  }

  return object;
}

const addProtocolToUrl = (unsafeUrl: string) => {
  const startsWithHttp = unsafeUrl.startsWith('http://');
  const startsWithHttps = unsafeUrl.startsWith('https://');
  if (startsWithHttp || startsWithHttps) return unsafeUrl;
  return `https://${unsafeUrl}`;
};

async function getImageEmbed(url: string): GetOGTagsReturn {
  const [dimensions, err] = await proxyUrlImageDimensions(url);

  if (err) return false;

  return {
    type: 'image',
    imageUrl: url,
    imageWidth: dimensions!.width,
    imageHeight: dimensions!.height,
    imageMime: (await fetch(url)).headers.get('content-type')!,
  };
}
