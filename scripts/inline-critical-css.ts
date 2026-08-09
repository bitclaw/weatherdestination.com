#!/usr/bin/env bun
/**
 * Postbuild step: inline critical CSS into the prerendered landing page.
 *
 * Only '/' is prerendered to a static HTML file (see vite.config.ts's
 * `prerender.filter`) - the built dist/client/index.html ships with a single
 * render-blocking <link rel="stylesheet"> pulling the entire app's CSS
 * (every page's Tailwind utilities in one file - Tailwind intentionally
 * shares one global stylesheet across the whole app rather than splitting
 * per route). TanStack Start's own `server.build.inlineCss` (on by default)
 * doesn't help here: it inlines CSS tied to per-route manifest chunks, and
 * this app's CSS isn't split that way - see docs/warpkit/performance.md.
 *
 * Runs as a separate script after `vite build` finishes (not a Vite plugin
 * hook) specifically to sidestep uncertainty about whether a
 * transformIndexHtml-based plugin would fire before or after TanStack
 * Start's prerender step writes the final index.html within the same
 * `vite build` invocation - this way it's guaranteed to run last, against
 * the real final file on disk.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Beasties from 'beasties';
import { extractDarkBlock } from './extract-dark-block';

const clientDir = path.resolve(process.cwd(), 'dist', 'client');
const indexPath = path.join(clientDir, 'index.html');
const stylesPath = path.resolve(process.cwd(), 'src', 'styles.css');

const beasties = new Beasties({
  path: clientDir,
  // Converts the remaining full stylesheet <link> to
  // rel="preload" + onload swap (the standard non-blocking pattern),
  // with a <noscript> fallback - see the noscriptFallback default (true).
  preload: 'swap',
  compress: true,
  logLevel: 'warn'
});

const html = await readFile(indexPath, 'utf8');
const inlined = await beasties.process(html);

// Beasties strips the .dark{...} block from critical CSS: the prerendered
// DOM it analyzes never has the `dark` class applied (prerender runs no
// browser JS), so every dark-mode token looks unused. Re-inject it as its
// own <style> after Beasties runs, so it isn't stripped a second time, and
// as a class-scoped rule (not inline-on-element) so the existing
// classList.toggle('dark', ...) theme switcher keeps working unchanged.
const stylesSource = await readFile(stylesPath, 'utf8');
const darkVars = extractDarkBlock(stylesSource);
if (!darkVars) {
  throw new Error(
    `[inline-critical-css] Could not find .dark block in ${path.relative(process.cwd(), stylesPath)}`
  );
}
const withDarkTokens = inlined.replace(
  '</head>',
  `<style>.dark{${darkVars}}</style></head>`
);

await writeFile(indexPath, withDarkTokens);

console.info(
  `[inline-critical-css] Inlined critical CSS into ${path.relative(process.cwd(), indexPath)}`
);
