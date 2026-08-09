// Notifies Bing/Yandex/etc. of every URL in the live sitemap via IndexNow,
// instead of waiting for organic recrawl. Usage: `make indexnow.submit`.
//
// Fetches the site's own /sitemap.xml rather than re-deriving the path list
// here - a second hand-maintained list would drift from sitemap.xml's own
// staticPaths the same way that file's own comment warns about.

import { config } from '@/config';

const key = process.env.INDEXNOW_KEY;
if (!key) {
  console.error(
    'INDEXNOW_KEY is not set. Run `make init` to generate one, or set it manually in .env.'
  );
  process.exit(1);
}

const domain = config.domainName;
const sitemapUrl = `https://${domain}/sitemap.xml`;

const sitemapRes = await fetch(sitemapUrl);
if (!sitemapRes.ok) {
  console.error(
    `Failed to fetch ${sitemapUrl}: ${sitemapRes.status} ${sitemapRes.statusText}`
  );
  process.exit(1);
}

const xml = await sitemapRes.text();
const urlList = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]!);

if (urlList.length === 0) {
  console.error(`No <loc> URLs found in ${sitemapUrl}`);
  process.exit(1);
}

// IndexNow caps a single request at 10,000 URLs - comfortably above this
// template's page count, but worth knowing if you extend it with a much
// larger sitemap (blog archive, per-tag pages, etc).
console.info(`Submitting ${urlList.length} URLs to IndexNow...`);

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: domain,
    key,
    keyLocation: `https://${domain}/${key}.txt`,
    urlList
  })
});

// IndexNow's documented responses: 200/202 success; 400 bad request; 403 key
// not valid (verification file missing/mismatched); 422 URLs don't belong to
// host or key mismatch; 429 too many requests.
if (response.status === 200 || response.status === 202) {
  console.info(`Success: ${response.status} ${response.statusText}`);
} else {
  const body = await response.text().catch(() => '');
  console.error(`IndexNow submission failed: ${response.status} ${body}`);
  process.exit(1);
}
