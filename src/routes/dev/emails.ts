import { createFileRoute } from '@tanstack/react-router';

const TEMPLATES = [
  { name: 'otp', label: 'OTP Login Code' },
  { name: 'magic-link', label: 'Magic Link' },
  { name: 'welcome', label: 'Welcome' },
  { name: 'receipt', label: 'Receipt' },
  { name: 'lead-confirmation', label: 'Lead Confirmation' }
];

export const Route = createFileRoute('/dev/emails')({
  server: {
    handlers: {
      GET: () => {
        if (process.env.NODE_ENV === 'production') {
          return new Response('Not found', { status: 404 });
        }

        const links = TEMPLATES.map(
          t =>
            `<a href="/dev/emails/${t.name}" target="preview" style="display:block;padding:10px 16px;text-decoration:none;color:#111827;border-radius:6px;font-size:14px" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">${t.label}</a>`
        ).join('\n');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Email Previews</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; display: flex; height: 100vh; background: #f9fafb; }
    nav { width: 220px; flex-shrink: 0; background: #fff; border-right: 1px solid #e5e7eb; padding: 16px 8px; display: flex; flex-direction: column; gap: 2px; }
    nav h1 { font-size: 12px; font-weight: 600; color: #9ca3af; letter-spacing: .05em; text-transform: uppercase; padding: 0 8px 12px; }
    iframe { flex: 1; border: none; background: #fff; }
  </style>
</head>
<body>
  <nav>
    <h1>Email Previews</h1>
    ${links}
  </nav>
  <iframe name="preview" src="/dev/emails/${TEMPLATES[0]?.name}"></iframe>
</body>
</html>`;

        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  }
});
