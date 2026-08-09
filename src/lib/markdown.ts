import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const chatProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export const renderChatMarkdown = (content: string): string =>
  String(chatProcessor.processSync(content));

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id', 'className']
  }
};

const rehypeShiftHeadings = () => (tree: import('hast').Root) => {
  visit(tree, 'element', (node: import('hast').Element) => {
    const match = /^h([1-6])$/.exec(node.tagName);
    if (match) {
      node.tagName = `h${Math.min(Number.parseInt(match[1]!, 10) + 1, 6)}`;
    }
  });
};

export type HeadingInfo = {
  id: string;
  text: string;
  level: number;
};

export type RenderedMarkdown = {
  html: string;
  headings: HeadingInfo[];
};

export async function renderMarkdown(
  content: string
): Promise<RenderedMarkdown> {
  const headings: HeadingInfo[] = [];

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: intentional assignment in conditional
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1]!.length;
    const text = match[2]!.trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    headings.push({ id, text, level });
  }

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeShiftHeadings)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeStringify)
    .process(content);

  return { html: String(result), headings };
}
