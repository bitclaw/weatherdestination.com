import { describe, expect, it } from 'bun:test';
import { ERROR_CODES } from '@/lib/constants';
import { getPostBySlug } from './blog.server';

describe('blog.server', () => {
  it('returns ok with data for existing slug', async () => {
    const result = await getPostBySlug('getting-started');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Getting Started with Your SaaS Template');
    expect(result.data.description).toBeTruthy();
    expect(result.data.html).toBeTruthy();
  });

  it('returns html from markdown rendering', async () => {
    const result = await getPostBySlug('getting-started');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.html).toContain('<');
    expect(result.data.html).toContain('>');
  });

  it('returns headings from markdown rendering', async () => {
    const result = await getPostBySlug('getting-started');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.data.headings)).toBe(true);
    expect(result.data.headings.length).toBeGreaterThan(0);
    for (const h of result.data.headings) {
      expect(typeof h.id).toBe('string');
      expect(typeof h.text).toBe('string');
      expect(typeof h.level).toBe('number');
    }
  });

  it('preserves frontmatter fields', async () => {
    const result = await getPostBySlug('getting-started');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.slug).toBe('getting-started');
    expect(result.data.published).toBeTruthy();
    expect(result.data.authors).toBeInstanceOf(Array);
    expect(result.data.category).toBeTruthy();
  });

  it('returns err for non-existent slug', async () => {
    const result = await getPostBySlug('this-post-does-not-exist');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('renders multiple posts correctly', async () => {
    const first = await getPostBySlug('getting-started');
    expect(first.ok).toBe(true);

    const second = await getPostBySlug('why-sqlite-per-user');
    expect(second.ok).toBe(true);

    if (!first.ok || !second.ok) return;
    expect(first.data.title).not.toBe(second.data.title);
    expect(first.data.html).not.toBe(second.data.html);
  });
});
