import { StartClient } from '@tanstack/react-start/client';
import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

// Overrides @tanstack/react-start's default client entry (same pattern as
// src/start.ts overriding the server entry - auto-detected by path, no
// vite.config.ts change needed) solely to pass onRecoverableError to
// hydrateRoot. Without it, a production hydration mismatch only surfaces
// as `Minified React error #418` with no component-level detail - React
// strips the descriptive message in production builds, but componentStack
// (built from function/component names, not the stripped message) survives
// minification, so this is the only way to find which component actually
// mismatched without shipping an unminified React build.
//
// One specific mismatch this template's critical-CSS setup (Beasties, see
// scripts/inline-critical-css.ts) can silently cause: Beasties hoists every
// <style> tag on the prerendered page into <head>, not just the main
// stylesheet <link>. A component-local <style>{...}</style> JSX tag gets
// moved out of its original DOM position, so the prerendered HTML no
// longer matches what the client bundle expects to hydrate there -
// see docs/warpkit/patterns/critical-css-inline-style.md.
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    {
      onRecoverableError: (error, errorInfo) => {
        console.error(
          'Hydration recoverable error:',
          error,
          'componentStack:',
          (errorInfo as { componentStack?: string })?.componentStack
        );
      }
    }
  );
});
