import { HTMLElement, parse } from 'node-html-parser';
import { proxyUrlImageDimensions } from './nerimityCDN';
import env from './env';
import { signatureHeaders } from 'web-bot-auth';
import { signerFromJWK } from 'web-bot-auth/crypto';

const PRIVATE_KEY = env.NERIMITY_EMBED_BOT_PRIVATE_KEY;
const USER_AGENT = 'NerimityBot/1.0 (+https://nerimity.com/bot)';

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
  }),
);

type GetOGTagsReturn = Promise<false | Record<string, string | number | boolean>>;

const youtubeLinkRegex = /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/;

async function getSignedRequest(url: string): Promise<Request> {
  const baseHeaders = { 'User-Agent': USER_AGENT };

  if (!PRIVATE_KEY) {
    return new Request(url, { headers: baseHeaders });
  }

  const request = new Request(url, { headers: baseHeaders });
  const now = new Date();

  const sigHeaders = await signatureHeaders(request, await signerFromJWK(PRIVATE_KEY), {
    created: now,
    expires: new Date(now.getTime() + 300_000),
  }).catch((err) => {
    console.error('Signing failed:', err);
    return null;
  });

  if (!sigHeaders) {
    return new Request(url, { headers: baseHeaders });
  }

  return new Request(url, {
    headers: {
      ...baseHeaders,
      Signature: sigHeaders['Signature'],
      'Signature-Input': sigHeaders['Signature-Input'],
    },
  });
}

export async function getOGTags(url: string): GetOGTagsReturn {
  const youtubeWatchCode = url.match(youtubeLinkRegex)?.[3];
  const updatedUrl = youtubeWatchCode ? `https://www.youtube.com/watch?v=${youtubeWatchCode}&hl=en&persist_hl=1` : url;

  const signedReq = await getSignedRequest(updatedUrl);

  const res = await fetch(signedReq).catch(() => {});
  if (!res) return false;

  const isImage = res.headers.get('content-type')?.startsWith('image/');
  if (isImage) {
    return await getImageEmbed(url, res);
  }

  const isHtml = res.headers.get('content-type')?.startsWith('text/html');
  if (!isHtml) return false;

  const html = await res.text().catch(() => {});

  if (!html) return false;
  const root = parse(html);
  const metaTags = root.querySelectorAll('head meta');

  const filteredOGTags = metaTags.filter((el) => {
    const isOG = el.attributes.property?.startsWith('og:');
    const isValidField = mapper.has(el.attributes.property?.split('og:')?.[1]);
    const hasContent = el.attributes.content;
    return isOG && isValidField && hasContent;
  });

  const entries = filteredOGTags.map((el) => [mapper.get(el.attributes.property.split('og:')[1]), el.attributes.content.substring(0, 1000)]);
  if (!youtubeWatchCode && !entries.length) return false;
  let object = Object.fromEntries(entries || []);

  const isTwitterStatus = (object.imageUrl && url.startsWith('https://twitter.com')) || url.startsWith('https://x.com');
  const largeImage = isTwitterStatus || metaTags.find((el) => el.attributes.name === 'twitter:card')?.attributes.content === 'summary_large_image';

  // DOES NOT WORK: Twitter stupidly has multiple different image urls for videos. one of them being the normal image url.
  // const isTwitterVideo = isTwitterStatus && (object.imageUrl.startsWith('https://pbs.twimg.com/ext_tw_video_thumb') || object.imageUrl.startsWith(' https://pbs.twimg.com/amplify_video_thumb'));

  if (largeImage) {
    object.largeImage = true;
  }
  // if (isTwitterVideo) {
  //   object.video = !!isTwitterVideo;
  // }

  if (object.imageUrl) {
    const [dimensions, err] = await proxyUrlImageDimensions(object.imageUrl);
    if (dimensions) {
      object.imageWidth = dimensions.width;
      object.imageHeight = dimensions.height;
    }
    if (!dimensions || err) {
      delete object.largeImage;
    }
  }

  if (youtubeWatchCode && !entries.length) {
    object = rateLimitedYoutube(root);
    if (!object) return false;
  }

  object.url = addProtocolToUrl(object.url || url);
  if (youtubeWatchCode) {
    object.url = addProtocolToUrl(updatedUrl);
  }

  if (object.imageUrl && (object.imageUrl.startsWith('http://') || object.imageUrl.startsWith('https://'))) {
    const signedImgReq = await getSignedRequest(object.imageUrl);
    const imgRes = await fetch(signedImgReq).catch(() => {});

    object.imageMime = imgRes?.headers.get('content-type');
    if (!object.imageMime) return false;
  }

  object.domain = new URL(url).hostname;
  object.origUrl = url;

  if (url.startsWith('https://klipy.com/') || (url.startsWith('https://tenor.com/') && object.imageUrl)) {
    object.type = 'image';
    delete object.title;
    delete object.siteName;
    delete object.description;
    delete object.origUrl;
    delete object.domain;
    delete object.url;
  }

  if (youtubeWatchCode) {
    const uploadDate = root.querySelector('meta[itemprop=uploadDate]')?.attributes?.content;

    const channelName = root.querySelector('span[itemprop=author] link[itemprop=name]')?.attributes?.content;

    uploadDate && (object.uploadDate = uploadDate);
    channelName && (object.channelName = channelName);
  }

  return object;
}

const addProtocolToUrl = (unsafeUrl: string) => {
  const startsWithHttp = unsafeUrl.startsWith('http://');
  const startsWithHttps = unsafeUrl.startsWith('https://');
  if (startsWithHttp || startsWithHttps) return unsafeUrl;
  return `https://${unsafeUrl}`;
};

async function getImageEmbed(url: string, res?: Response): GetOGTagsReturn {
  const [dimensions, err] = await proxyUrlImageDimensions(url);

  if (err) return false;

  let resForSure = res;
  if (!resForSure) {
    const signedReq = await getSignedRequest(url);
    resForSure = (await fetch(signedReq).catch(() => {})) as Response;
  }

  return {
    type: 'image',
    imageUrl: url,
    imageWidth: dimensions!.width,
    imageHeight: dimensions!.height,
    animated: dimensions!.animated,
    imageMime: resForSure.headers.get('content-type')!,
  };
}

function rateLimitedYoutube(root: HTMLElement) {
  const ytInitialDataStartWith = `var ytInitialData = `;

  const script = root.getElementsByTagName('script').find((el) => {
    return el.innerText.startsWith(ytInitialDataStartWith);
  });
  if (!script) return;

  const rawYtInitialData = script.innerText.substring(ytInitialDataStartWith.length, script.innerText.length - 1);
  const ytInitialData = JSON.parse(rawYtInitialData);

  const videoPrimaryInfoRenderer = ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer;
  const videoSecondaryInfoRenderer = ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[1]?.videoSecondaryInfoRenderer;

  const channelName = videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text;
  const title = videoPrimaryInfoRenderer?.title?.runs?.[0]?.text;
  const viewCount = videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer?.originalViewCount;
  const uploadedAt = videoPrimaryInfoRenderer?.relativeDateText?.simpleText;
  const description = videoSecondaryInfoRenderer?.attributedDescription?.content?.slice?.(0, 200);

  if (!videoPrimaryInfoRenderer || !videoSecondaryInfoRenderer) return false;

  return {
    title,
    channelName,
    description,
    uploadDate: uploadedAt,
    viewCount,
  };
}
