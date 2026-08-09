import { err, ok } from '@bitclaw/result';
import { allPosts } from 'content-collections';
import { ERROR_CODES } from '@/lib/constants';
import { renderMarkdown } from '@/lib/markdown';

export const getPostBySlug = async (
  slug: string
): Promise<
  | { ok: false; code: string; message: string }
  | {
      ok: true;
      data: {
        title: string;
        description: string;
        published: string;
        authors: string[];
        category: string;
        slug: string;
        image?: string;
        html: string;
        headings: Array<{ id: string; text: string; level: number }>;
      };
    }
> => {
  const post = allPosts.find(p => p.slug === slug);
  if (!post) return err(ERROR_CODES.NOT_FOUND, 'Post not found');
  const rendered = await renderMarkdown(post.content);
  return ok({ ...post, html: rendered.html, headings: rendered.headings });
};
