const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileRenderOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
};

type TurnstileApi = {
  render: (
    element: string | HTMLElement,
    options: TurnstileRenderOptions
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
};

let loadPromise: Promise<void> | null = null;

export function loadTurnstileScript(): Promise<void> {
  if (loadPromise) return loadPromise;

  if (getTurnstileApi()) {
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${SCRIPT_URL}"]`
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Turnstile script'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () =>
      reject(new Error('Failed to load Turnstile script'))
    );
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function getTurnstileApi(): TurnstileApi | null {
  // weak-type-ok: reading a global injected by the third-party Turnstile script tag
  return ((window as unknown as Record<string, unknown>).turnstile ??
    null) as TurnstileApi | null;
}
