import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptchaContext, type CaptchaContextValue } from './context';
import { getTurnstileApi, loadTurnstileScript } from './turnstile-loader';

type TurnstileProviderProps = {
  siteKey: string;
  children: React.ReactNode;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
};

export function TurnstileProvider({
  siteKey,
  children,
  theme = 'auto',
  size = 'normal'
}: TurnstileProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

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

    widgetIdRef.current = api.render(containerRef.current, {
      sitekey: siteKey,
      callback: (t: string) => setToken(t),
      'error-callback': () => setToken(null),
      'expired-callback': () => setToken(null),
      theme,
      size
    });

    setIsReady(true);
  }, [siteKey, theme, size]);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (!cancelled) renderWidget();
    });

    return () => {
      cancelled = true;
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
  }, [renderWidget]);

  // Call when the element holding containerRef is about to unmount from a
  // JSX branch change (e.g. switching from an "enter email" step to an
  // "enter OTP" step) rather than this provider itself unmounting. Turnstile
  // notices its container leaving the DOM and self-invalidates the widget,
  // but our own widgetIdRef doesn't know that; without this, a later
  // reset() throws an uncaught "Nothing to reset found for provided
  // container" instead of being a clean no-op, and Turnstile logs its own
  // "Cannot find Widget" warning when it self-detects the removal.
  const detach = () => {
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
    reset,
    detach,
    remount: renderWidget,
    containerRef
  };

  return (
    <CaptchaContext.Provider value={value}>{children}</CaptchaContext.Provider>
  );
}
