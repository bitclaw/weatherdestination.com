/**
 * Generate favicon and icon assets from source SVGs.
 *
 * Usage:
 *   bun run generate:favicons   (or: make favicons)
 *
 * Source files (replace these when rebranding):
 *   public/icon.svg   , symbol only (used for favicons + app icons)
 *   public/logo.svg   , full wordmark (used for OG image)
 *
 * Generated assets (written to public/, commit them):
 *   favicon.ico                 , multi-size ICO (16, 32, 48)
 *   favicon-16x16.png
 *   favicon-32x32.png
 *   apple-touch-icon.png        , 180x180 (iOS home screen)
 *   android-chrome-192x192.png  , Android / PWA icon
 *   android-chrome-512x512.png  , Android / PWA splash
 *   og-image.png                , 1200x630 social sharing image
 *   site.webmanifest            , PWA manifest
 */
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';
import { config } from '../config';

// biome-ignore lint/suspicious/noConsole: CLI script output
const log = console.log;

const PUBLIC = path.join(import.meta.dir, '..', 'public');
const ICON_SVG_PATH = path.join(PUBLIC, 'icon.svg');
const LOGO_SVG_PATH = path.join(PUBLIC, 'logo.svg');

if (!fs.existsSync(ICON_SVG_PATH)) {
  console.error('Error: public/icon.svg not found. Add your icon SVG first.');
  process.exit(1);
}
if (!fs.existsSync(LOGO_SVG_PATH)) {
  console.error('Error: public/logo.svg not found. Add your logo SVG first.');
  process.exit(1);
}

const iconSvg = fs.readFileSync(ICON_SVG_PATH, 'utf8');
const logoSvg = fs.readFileSync(LOGO_SVG_PATH, 'utf8');

function renderSvg(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: width },
    background: 'rgba(0,0,0,0)'
  });
  return Buffer.from(resvg.render().asPng());
}

// Wraps logoSvg in a 1200x630 white-background SVG, centered with padding.
// Pure SVG composition , no extra deps, produces exactly 1200x630.
function makeOgSvg(
  svg: string,
  targetW = 1200,
  targetH = 630,
  padding = 120
): string {
  const vbMatch = svg.match(/viewBox="([^"]+)"/);
  const parts = (vbMatch?.[1] ?? '0 0 1 1').split(/\s+/).map(Number);
  const [, , vw = 1, vh = 1] = parts;
  const aspect = vw / vh;
  const maxW = targetW - padding * 2;
  const maxH = targetH - padding * 2;
  let w = maxW;
  let h = maxW / aspect;
  if (h > maxH) {
    h = maxH;
    w = maxH * aspect;
  }
  const x = (targetW - w) / 2;
  const y = (targetH - h) / 2;
  const viewBox = vbMatch?.[1] ?? '0 0 1 1';
  const inner = svg.replace(/<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${targetW}" height="${targetH}">
  <rect width="${targetW}" height="${targetH}" fill="white"/>
  <svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}">${inner}</svg>
</svg>`;
}

async function main() {
  log('Generating favicons and icons...\n');

  // Icon PNGs , render at exact target size (no sharp needed)
  const sizes: Array<[number, string]> = [
    [16, 'favicon-16x16.png'],
    [32, 'favicon-32x32.png'],
    [48, 'favicon-48x48.png'],
    [180, 'apple-touch-icon.png'],
    [192, 'android-chrome-192x192.png'],
    [512, 'android-chrome-512x512.png']
  ];

  for (const [size, filename] of sizes) {
    const png = renderSvg(iconSvg, size);
    fs.writeFileSync(path.join(PUBLIC, filename), png);
    log(`  ✓ ${filename} (${size}x${size})`);
  }

  // favicon.ico , multi-size from 16, 32, 48
  const ico16 = fs.readFileSync(path.join(PUBLIC, 'favicon-16x16.png'));
  const ico32 = fs.readFileSync(path.join(PUBLIC, 'favicon-32x32.png'));
  const ico48 = fs.readFileSync(path.join(PUBLIC, 'favicon-48x48.png'));
  const icoBuffer = await pngToIco([ico16, ico32, ico48]);
  fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), icoBuffer);
  fs.unlinkSync(path.join(PUBLIC, 'favicon-48x48.png'));
  log('  ✓ favicon.ico (16+32+48)');

  // OG image , logo on 1200x630 white canvas
  const ogSvg = makeOgSvg(logoSvg);
  const ogPng = renderSvg(ogSvg, 1200);
  fs.writeFileSync(path.join(PUBLIC, 'og-image.png'), ogPng);
  log('  ✓ og-image.png (1200x630)');

  // site.webmanifest
  const manifest = {
    name: config.appName,
    short_name: config.appName,
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone'
  };
  fs.writeFileSync(
    path.join(PUBLIC, 'site.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  log('  ✓ site.webmanifest');

  log('\nDone. All assets written to public/');
  log('Commit them , consumers run make favicons after rebranding.\n');
}

main().catch(console.error);
