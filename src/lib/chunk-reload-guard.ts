// A stale tab (loaded before a deploy) can end up requesting a hashed asset
// chunk that no longer exists on the server - old release directories get
// replaced on every deploy. That surfaces as a browser dynamic-import
// failure. Reload once to pick up the current build instead of leaving the
// user on a broken page. Guarded by sessionStorage so a genuinely broken
// chunk doesn't loop forever.
const CHUNK_LOAD_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w.-]+ failed|error loading dynamically imported module/i;

// Vite's default hashed-asset output prefix for this app (confirmed against
// vite.config.ts's default build.rollupOptions.output and server/start.ts's
// /assets/* static-serving convention). A <script>/<link> load failure only
// means "stale build" if it's one of ours - matching this tightly avoids
// treating a blocked/failed third-party script (Crisp, Umami, Clarity,
// Turnstile, Stripe, Sentry - or any ad-blocked CDN) as a reason to
// force-reload the page out from under the user.
const TRACKED_ASSET_PATH_PREFIX = '/assets/';

const RELOAD_FLAG = 'runmist:chunk-reload-attempted';

export const isChunkLoadError = (message: string | null | undefined): boolean =>
  !!message && CHUNK_LOAD_ERROR_RE.test(message);

// Resource-load failures (<script>/<link> 404s) dispatch a plain Event with
// no .message and don't bubble - this is the counterpart check for that case,
// driven by the failed element's URL instead of an error message.
export const isTrackedAssetFailure = (
  url: string,
  currentOrigin: string
): boolean => {
  try {
    const parsed = new URL(url, currentOrigin);
    return (
      parsed.origin === currentOrigin &&
      parsed.pathname.startsWith(TRACKED_ASSET_PATH_PREFIX)
    );
  } catch {
    return false;
  }
};

const reloadOnce = () => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
};

export function installChunkReloadGuard(): void {
  // capture: true is required to observe <script>/<link> resource-load
  // failures at all (they don't bubble to window), and also still catches
  // ordinary uncaught-exception error events, since window sits in the
  // capture path for those regardless.
  window.addEventListener(
    'error',
    event => {
      const target = event.target;
      if (
        target instanceof HTMLScriptElement ||
        target instanceof HTMLLinkElement
      ) {
        const url =
          target instanceof HTMLScriptElement ? target.src : target.href;
        if (url && isTrackedAssetFailure(url, location.origin)) reloadOnce();
        return;
      }
      if (isChunkLoadError(event.message)) reloadOnce();
    },
    true
  );

  window.addEventListener('unhandledrejection', event => {
    const message =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
    if (isChunkLoadError(message)) reloadOnce();
  });

  // A page that finished mounting has the current build's chunks - clear the
  // flag so a later, unrelated chunk failure still gets one reload attempt.
  window.setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10_000);
}
