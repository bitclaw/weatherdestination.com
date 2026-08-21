import { describe, expect, it } from 'bun:test';
import type { Post } from 'content-collections';
import { buildRobotsTxt, buildSitemapXml } from '@/lib/seo-static';

const makePost = (slug: string): Post => ({ slug }) as Post;

describe('buildRobotsTxt', () => {
  it('injects the given domain into the sitemap URL', () => {
    const txt = buildRobotsTxt('example.com');
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
  });
});

describe('buildSitemapXml', () => {
  it('includes every static path with the given domain', () => {
    const xml = buildSitemapXml('example.com', []);
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<loc>https://example.com/pricing</loc>');
    expect(xml).toContain('<loc>https://example.com/compare</loc>');
  });

  it('excludes /login and /signup', () => {
    const xml = buildSitemapXml('example.com', []);
    expect(xml).not.toContain('/login');
    expect(xml).not.toContain('/signup');
  });

  it('includes blog posts', () => {
    const xml = buildSitemapXml('example.com', [makePost('hello-world')]);
    expect(xml).toContain('<loc>https://example.com/blog/hello-world</loc>');
  });

  it('produces valid XML shape', () => {
    const xml = buildSitemapXml('example.com', []);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
  });
});
