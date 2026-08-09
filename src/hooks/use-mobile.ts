import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export const useIsMobile = () => {
  return React.useSyncExternalStore(
    callback => {
      const mql = window.matchMedia(MOBILE_QUERY);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  );
};
