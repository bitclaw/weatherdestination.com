# Captcha (Cloudflare Turnstile)

Optional Cloudflare Turnstile integration to protect public forms (login, lead capture).

## Activation

Set env vars -- no code change needed:

```bash
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
TURNSTILE_SECRET_KEY=0x4AAAAAAA...
```

`config.auth.turnstile` is derived from `VITE_TURNSTILE_SITE_KEY`. The login page renders the widget automatically when the key is present.

## Client-side usage

Wrap forms with `TurnstileProvider`:

```tsx
import { TurnstileProvider, useCaptcha } from '@/features/captcha';

function MyForm() {
  const { getToken } = useCaptcha();

  const handleSubmit = async () => {
    const token = await getToken();
    await submitForm({ token });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

export function MyPage() {
  return (
    <TurnstileProvider>
      <MyForm />
    </TurnstileProvider>
  );
}
```

`NoCaptchaProvider` is available for development/testing -- passes through without rendering the widget.

## Server-side verification

For a custom route not behind better-auth's own captcha plugin (e.g. the public
lead-capture endpoint), verify the token with `verifyTurnstileToken` , dynamic-import it
inside the handler body, it's not re-exported from the feature barrel:

```ts
if (process.env.TURNSTILE_SECRET_KEY) {
  const { verifyTurnstileToken } = await import(
    '@/features/captcha/verify-turnstile.server'
  );
  const valid = await verifyTurnstileToken(data.turnstileToken ?? '', ip ?? undefined);
  if (!valid) {
    return Response.json({ error: 'Captcha verification failed' }, { status: 403 });
  }
}
```

`verifyTurnstileToken(token, remoteIp?, timeoutMs = 10_000)` fails **open** (returns
`true`) when `TURNSTILE_SECRET_KEY` is unset, matching the "activates via env var"
convention , and fails **closed** (returns `false`) on a network error or timeout, since
this is a security check. See `src/routes/api/v1/lead.ts` for the reference call site.

## Files

- `src/features/captcha/TurnstileProvider.tsx` -- widget renderer
- `src/features/captcha/NoCaptchaProvider.tsx` -- no-op for dev
- `src/features/captcha/verify-turnstile.server.ts` -- server-side siteverify call
- `src/features/captcha/context.ts` + `use-captcha.ts` -- context and hook
- `src/features/captcha/turnstile-loader.ts` -- script loader
