import { config } from '@/config';

type SeoMetaParams = {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  type?: 'website' | 'article';
  // For pages with no unique indexable content (e.g. a login/signup form) -
  // keeps them crawlable (still `follow`, so internal links still get
  // discovered) but out of search results, rather than padding thin
  // functional UI with marketing copy just to clear a word-count check.
  noindex?: boolean;
};

export function getSeoMeta(params: SeoMetaParams = {}) {
  const {
    title = config.seo.defaultTitle,
    description = config.seo.defaultDescription,
    url = `https://${config.domainName}`,
    image: rawImage = config.seo.defaultOgImage,
    type = 'website',
    noindex = false
  } = params;

  // og:image/twitter:image must be absolute , social crawlers don't resolve
  // relative paths against the page origin. config.seo.defaultOgImage is
  // intentionally written as a simple relative path ('/og-image.png') since
  // that's how a template consumer would naturally set it; resolve to
  // absolute here instead.
  const image =
    rawImage && !/^https?:\/\//.test(rawImage)
      ? `https://${config.domainName}${rawImage}`
      : rawImage;

  return [
    { title },
    { name: 'description', content: description },
    ...(noindex ? [{ name: 'robots', content: 'noindex, follow' }] : []),
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:type', content: type },
    ...(image ? [{ property: 'og:image', content: image }] : []),
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(image ? [{ name: 'twitter:image', content: image }] : []),
    ...(config.seo.twitterHandle
      ? [{ name: 'twitter:site', content: config.seo.twitterHandle }]
      : [])
  ];
}

type JsonLdParams = {
  type: 'Article' | 'WebSite' | 'Organization' | 'SoftwareApplication';
  name: string;
  description?: string;
  url?: string;
  datePublished?: string;
  author?: string;
};

export function getJsonLd(params: JsonLdParams) {
  const base = {
    '@context': 'https://schema.org',
    '@type': params.type,
    name: params.name,
    description: params.description,
    url: params.url
  };

  if (params.type === 'Article') {
    return {
      ...base,
      datePublished: params.datePublished,
      author: params.author
        ? { '@type': 'Person', name: params.author }
        : undefined
    };
  }

  if (params.type === 'SoftwareApplication') {
    return {
      ...base,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      }
    };
  }

  return base;
}

// JSON.stringify doesn't escape `<`, so a value containing `</script>` (e.g.
// a future blog post title) would prematurely close the script tag this is
// rendered into via dangerouslySetInnerHTML. Always serialize JSON-LD
// through this helper, never JSON.stringify directly.
export function stringifyJsonLd(jsonLd: unknown): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}
