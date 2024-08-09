interface Options {
  largeImage?: boolean;
  url: string;
  title: string;
  imageUrl?: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  description: string;
}

export const makeOpenGraph = (opts: Options) => {
  const siteName = `<meta content="Nerimity" property="og:site_name" />`;
  const type = `<meta content="article" property="og:type" />`;
  const url = `<meta content="${opts.url}" property="og:url" />`;
  const title = `<meta content="${opts.title}" property="og:title" />`;
  const description = `<meta content="${opts.description}" property="og:description" />`;
  const image = opts.imageUrl ? `<meta content="${opts.imageUrl}" property="og:image" />` : '';
  const imageWidth = opts.imageWidth ? `<meta content="${opts.imageWidth}" property="og:image:width" />` : '';
  const imageHeight = opts.imageHeight ? `<meta content="${opts.imageHeight}" property="og:image:height" />` : '';

  const themeColor = `<meta name="theme-color" content="#4c93ff">`;

  const title1 = `<title>${opts.title}</title>`;
  const title2 = `<meta name="title" content="${opts.title}">`;
  const htmlDescription = `<meta name="description" content="${opts.description}">`;

  const largeImage = opts.largeImage ? `<meta name="twitter:card" content="summary_large_image">` : '';
  const twitterDomain = `<meta name="twitter:domain" content="https://nerimity.com">`;
  const twitterUrl = `<meta name="twitter:url" content="${opts.url}">`;
  const twitterDescription = `<meta name="twitter:description" content="${opts.description}">`;
  const twitterTitle = `<meta name="twitter:title" content="${opts.title}">`;
  const twitterImage = opts.imageUrl ? `<meta name="twitter:image" content="${opts.imageUrl}">` : '';

  return `<!DOCTYPE html><html><head>${title1}${title2}${htmlDescription}${siteName}${type}${themeColor}${url}${title}${description}${imageWidth}${imageHeight}${largeImage}${image}${twitterDomain}${twitterUrl}${twitterDescription}${twitterTitle}${twitterImage}</head></html>`;
};
