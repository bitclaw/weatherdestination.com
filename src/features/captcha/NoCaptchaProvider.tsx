import { useRef } from 'react';
import { CaptchaContext, type CaptchaContextValue } from './context';

export function NoCaptchaProvider({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const value: CaptchaContextValue = {
    token: null,
    isReady: true,
    reset: () => {},
    detach: () => {},
    remount: () => {},
    containerRef
  };

  return (
    <CaptchaContext.Provider value={value}>{children}</CaptchaContext.Provider>
  );
}
