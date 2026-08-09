# Blog

Static blog at `/blog` and `/blog/:slug`. Renders Markdown or JSON posts via `content-collections`.

## Content source

Posts live in `src/content/blog/` as `.md` or `.mdx` files. `content-collections` processes them at build time into typed collections.

**File structure:**

```
src/content/
└── blog/
    ├── my-first-post.md
    └── getting-started.md
```

**Frontmatter fields:**

```yaml
---
title: My Post Title
description: Short summary for SEO and cards.
date: 2026-01-15
published: true
---
```

## Server functions

`src/features/blog/server/blog.queries.ts`:
- `listPosts` -- returns all published posts sorted by date (GET, public)
- `getPost({ slug })` -- returns a single post by slug (GET, public)

Both are unauthenticated. No per-user SQLite involved.

## Routes

- `src/routes/blog.tsx` -- layout with `<Outlet />`
- `src/routes/blog.index.tsx` -- post list page
- `src/routes/blog.$slug.tsx` -- single post page

## SEO

Posts use `createSeo()` from `@/lib/seo` for per-page meta tags. Set `title`, `description`, and `ogImage` in the route's `head()` function.

## Adding a post

1. Create `content/blog/my-slug.md` with required frontmatter
2. Set `published: true` to make it visible
3. The post appears automatically at `/blog/my-slug`
