import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptchaContext, type CaptchaContextValue } from './context';
import { getTurnstileApi, loadTurnstileScript } from './turnstile-loader';

type TurnstileProviderProps = {
  siteKey: string;
  children: React.ReactNode;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
};

// How long to wait, after the widget actually attaches, before treating it
// as failed if neither a token nor an error has arrived - guards against
// challenges.cloudflare.com itself being unreachable without the script
// tag's own error event firing.
const RENDER_TIMEOUT_MS = 8000;

export function TurnstileProvider({
  siteKey,
  children,
  theme = 'auto',
  size = 'normal'
}: TurnstileProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef(0);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const clearFailTimer = useCallback(() => {
    if (failTimerRef.current !== null) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
  }, []);

  const renderWidget = useCallback(() => {
    const api = getTurnstileApi();
    if (!containerRef.current || !api) return;

    if (widgetIdRef.current !== null) {
      try {
        api.remove(widgetIdRef.current);
      } catch {
        // Already gone (container previously unmounted without detach()) -
        // nothing to remove.
      }
      widgetIdRef.current = null;
    }

    errorCountRef.current = 0;
    setLoadFailed(false);

    widgetIdRef.current = api.render(containerRef.current, {
      sitekey: siteKey,
      callback: (t: string) => {
        clearFailTimer();
        setToken(t);
      },
      'error-callback': () => {
        setToken(null);
        errorCountRef.current += 1;
        // Turnstile auto-retries once by default - a single error is
        // normal and often self-recovers. Two without an intervening
        // success means it's genuinely stuck.
        if (errorCountRef.current >= 2) {
          clearFailTimer();
          setLoadFailed(true);
        }
      },
      'expired-callback': () => setToken(null),
      theme,
      size
    });

    setIsReady(true);

    clearFailTimer();
    failTimerRef.current = setTimeout(() => {
      setLoadFailed(true);
    }, RENDER_TIMEOUT_MS);
  }, [siteKey, theme, size, clearFailTimer]);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (!cancelled) renderWidget();
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      clearFailTimer();
      const api = getTurnstileApi();
      if (widgetIdRef.current !== null && api) {
        try {
          api.remove(widgetIdRef.current);
        } catch {
          // Already gone - nothing to remove.
        }
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, clearFailTimer]);

  // Call when the element holding containerRef is about to unmount from a
  // JSX branch change (e.g. switching from an "enter email" step to an
  // "enter OTP" step) rather than this provider itself unmounting. Turnstile
  // notices its container leaving the DOM and self-invalidates the widget,
  // but our own widgetIdRef doesn't know that; without this, a later
  // reset() throws an uncaught "Nothing to reset found for provided
  // container" instead of being a clean no-op, and Turnstile logs its own
  // "Cannot find Widget" warning when it self-detects the removal.
  const detach = () => {
    clearFailTimer();
    const api = getTurnstileApi();
    if (widgetIdRef.current !== null && api) {
      try {
        api.remove(widgetIdRef.current);
      } catch {
        // Turnstile may have already self-invalidated it - fine either way.
      }
    }
    widgetIdRef.current = null;
    setToken(null);
  };

  const reset = () => {
    setToken(null);
    const api = getTurnstileApi();
    if (widgetIdRef.current !== null && api) {
      try {
        api.reset(widgetIdRef.current);
      } catch {
        // Widget already gone - nothing to reset.
        widgetIdRef.current = null;
      }
    }
  };

  const value: CaptchaContextValue = {
    token,
    isReady,
    loadFailed,
    reset,
    detach,
    remount: renderWidget,
    containerRef
  };

  return (
    <CaptchaContext.Provider value={value}>{children}</CaptchaContext.Provider>
  );
}
