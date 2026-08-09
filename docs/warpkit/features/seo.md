# SEO Utilities

Two helpers in `src/lib/seo.ts` centralize meta tags and structured data so every
public page emits consistent SEO markup without hand-rolling tag arrays.

## `getSeoMeta(params?)`

Returns a TanStack Router `head.meta` array: title, description, Open Graph
(`og:title`, `og:description`, `og:url`, `og:type`, optional `og:image`), and Twitter
card tags. Every field falls back to `config.seo` defaults (`defaultTitle`,
`defaultDescription`, `defaultOgImage`, `twitterHandle`) and `config.domainName`, so a
bare `getSeoMeta()` is always valid.

```ts
import { getSeoMeta } from '@/lib/seo';

export const Route = createFileRoute('/_landing/pricing')({
  head: () => ({
    meta: getSeoMeta({
      title: 'Pricing',
      description: 'Simple plans that scale with you.',
      url: `https://${config.domainName}/pricing`
    })
  }),
  component: PricingPage
});
```

Params: `title`, `description`, `url`, `image`, `type` (`'website' | 'article'`),
`noindex` , all optional. `og:image`/`twitter:image` and `twitter:site` are emitted
only when a value exists, so unset config never produces empty tags.

Pass `noindex: true` for pages with no unique indexable content (a login/signup
form, for example) , this keeps the page crawlable (`noindex, follow`, so internal
links are still discovered) but out of search results, instead of padding thin
functional UI with copy just to satisfy a word-count check. See
`src/routes/_auth.login.tsx` for the reference usage.

## `getJsonLd(params)`

Returns a schema.org JSON-LD object for `Article`, `WebSite`, `Organization`, or
`SoftwareApplication`. `Article` adds `datePublished` + `author` (as a `Person`);
`SoftwareApplication` adds the category/OS/offer boilerplate Google expects for app
listings. Render it into a script tag in the route head using `stringifyJsonLd`, not
raw `JSON.stringify` , `JSON.stringify` doesn't escape `<`, so a value containing
`</script>` (e.g. a future blog post title) would prematurely close the script tag:

```ts
scripts: [
  {
    type: 'application/ld+json',
    children: stringifyJsonLd(
      getJsonLd({ type: 'Article', name: post.title, datePublished: post.date })
    )
  }
];
```

## Where it's used

All `_landing.*` routes (index, pricing, features, blog index + `$slug`, tos,
privacy, changelog) and the `compare/*` pages. Blog post routes are the reference
for the `Article` JSON-LD + `type: 'article'` meta combination
(`src/routes/_landing.blog.$slug.tsx`).

## Adding SEO to a new public page

1. Add `head: () => ({ meta: getSeoMeta({ ... }) })` to the route definition.
2. Pass an absolute `url` (prefix with `https://${config.domainName}`).
3. Only pages that should rank need JSON-LD; skip it for utility pages.
4. Defaults live in `config.ts` under `seo:` , change branding there, not per page.
