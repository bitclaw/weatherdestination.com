import type { RefObject } from 'react';
import { createContext } from 'react';

export type CaptchaContextValue = {
  token: string | null;
  isReady: boolean;
  reset: () => void;
  /**
   * Call when the element holding the widget (containerRef) is about to
   * unmount from a JSX branch change (not a route/provider unmount, which
   * TurnstileProvider's own effect cleanup already handles). Without this,
   * Turnstile self-invalidates the widget once its container leaves the
   * DOM but our widget id ref doesn't know that, so any later reset()
   * throws "Nothing to reset found for provided container" as an uncaught
   * exception instead of a clean no-op.
   */
  detach: () => void;
  /**
   * Re-render the widget into containerRef.current. Needed after detach()
   * was called and the container later remounts (e.g. user goes back from
   * the OTP step to the email step) -- the provider's own mount effect
   * only runs once, so nothing else re-attaches the widget to a freshly
   * mounted container on its own.
   */
  remount: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
};

export const CaptchaContext = createContext<CaptchaContextValue | null>(null);
