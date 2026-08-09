import { init } from '@sentry/tanstackstart-react';
import { config } from '@/config';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    // Sentry's SDK auto-instruments window.onerror/unhandledrejection by
    // default, which also catches errors thrown by third-party scripts we
    // load (Clarity, Crisp, Cloudflare Turnstile) - none of which we can
    // fix, and which would otherwise pollute the error stream and make our
    // own real errors harder to find. denyUrls filters by the script's own
    // origin (works even for cross-origin scripts where the stack trace is
    // opaque - "Uncaught TypeError: ..." style errors give no other
    // identifying info); ignoreErrors catches noise that doesn't cleanly
    // attribute to a URL (a documented list of common non-actionable
    // browser/extension noise).
    denyUrls: [
      /clarity\.ms/,
      /client\.crisp\.chat/,
      /challenges\.cloudflare\.com/,
      /cloud\.umami\.is/,
      // Browser extensions injecting scripts into the page.
      /extensions\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i
    ],
    ignoreErrors: [
      // Benign, well-documented browser quirk - not actionable.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications'
    ],
    allowUrls: [new RegExp(config.domainName.replace(/\./g, '\\.'))]
  });
};
