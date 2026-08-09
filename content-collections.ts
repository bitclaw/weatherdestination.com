import { defineCollection, defineConfig } from '@content-collections/core';
import { z } from 'zod';

const posts = defineCollection({
  name: 'posts',
  directory: 'src/content/blog',
  include: '**/*.md',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.string(),
    authors: z.array(z.string()).default(['Team']),
    category: z.string().default('general'),
    image: z.string().optional(),
    // Explicit, not redundant: Content Collections deprecated implicitly
    // adding this field (see [CC DEPRECATED] build warning without it).
    content: z.string()
  }),
  transform: document => {
    const slug = document._meta.fileName.replace(/\.md$/, '');
    return { ...document, slug };
  }
});

const releases = defineCollection({
  name: 'releases',
  directory: 'src/content/changelog',
  include: '**/*.md',
  schema: z.object({
    version: z.string(),
    date: z.string(),
    title: z.string(),
    tags: z.array(z.string()).default([]),
    // Explicit, not redundant: Content Collections deprecated implicitly
    // adding this field (see [CC DEPRECATED] build warning without it).
    content: z.string()
  }),
  transform: document => ({
    ...document,
    slug: document._meta.fileName.replace(/\.md$/, '')
  })
});

export default defineConfig({
  content: [posts, releases]
});
