export const makeOpenGraph = (opts: { largeImage?: boolean; url: string; title: string; image?: string; description: string }) => {
  const siteName = `<meta content="Nerimity" property="og:site_name" />`;
  const type = `<meta content="article" property="og:type" />`;
  const url = `<meta content="${opts.url}" property="og:url" />`;
  const title = `<meta content="${opts.title}" property="og:title" />`;
  const description = `<meta content="${opts.description}" property="og:description" />`;
  const image = opts.image ? `<meta content="${opts.image}" property="og:image" />` : '';
  const largeImage = opts.largeImage ? `<meta name="twitter:card" content="summary_large_image">` : '';

  const themeColor = `<meta name="theme-color" content="#4c93ff">`;

  return `<!DOCTYPE html><html><head>${siteName}${type}${themeColor}${url}${title}${description}${largeImage}${image}</head></html>`;
};
