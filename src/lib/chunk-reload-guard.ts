// A stale tab (loaded before a deploy) can end up requesting a hashed asset
// chunk that no longer exists on the server - old release directories get
// replaced on every deploy. That surfaces as a browser dynamic-import
// failure. Reload once to pick up the current build instead of leaving the
// user on a broken page. Guarded by sessionStorage so a genuinely broken
// chunk doesn't loop forever.
const CHUNK_LOAD_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w.-]+ failed|error loading dynamically imported module/i;

const RELOAD_FLAG = 'runmist:chunk-reload-attempted';

const isChunkLoadError = (message: string | null | undefined): boolean =>
  !!message && CHUNK_LOAD_ERROR_RE.test(message);

const reloadOnce = () => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
};

export function installChunkReloadGuard(): void {
  window.addEventListener('error', event => {
    if (isChunkLoadError(event.message)) reloadOnce();
  });

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
