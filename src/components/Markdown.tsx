export function Markdown({ html }: { html: string }) {
  return (
    <div
      className="prose prose-neutral dark:prose-invert max-w-none"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by rehype-sanitize
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
