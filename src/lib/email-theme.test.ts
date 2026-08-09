import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractCssVar, oklchToHex } from './email-theme';

const HEX_RE = /^#[0-9a-f]{6}$/;

describe('oklchToHex', () => {
  it('converts white (100% lightness, 0 chroma)', () => {
    expect(oklchToHex('oklch(100% 0 0)')).toBe('#ffffff');
  });

  it('converts black (0% lightness, 0 chroma)', () => {
    expect(oklchToHex('oklch(0% 0 0)')).toBe('#000000');
  });

  it('accepts decimal lightness without percent', () => {
    expect(oklchToHex('oklch(1.0 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
  });

  it('accepts deg suffix on hue', () => {
    const withDeg = oklchToHex('oklch(50% 0.2 200deg)');
    const withoutDeg = oklchToHex('oklch(50% 0.2 200)');
    expect(withDeg).toBe(withoutDeg);
  });

  it('returns valid 6-char lowercase hex', () => {
    expect(oklchToHex('oklch(43% 0.22 265)')).toMatch(HEX_RE);
    expect(oklchToHex('oklch(70% 0.15 30)')).toMatch(HEX_RE);
    expect(oklchToHex('oklch(50% 0.2 200)')).toMatch(HEX_RE);
  });

  it('clamps out-of-gamut values without throwing', () => {
    expect(() => oklchToHex('oklch(50% 0.4 120)')).not.toThrow();
    expect(oklchToHex('oklch(50% 0.4 120)')).toMatch(HEX_RE);
  });

  it('throws on invalid format', () => {
    expect(() => oklchToHex('hsl(120, 50%, 50%)')).toThrow('Invalid OKLCH');
    expect(() => oklchToHex('#ff0000')).toThrow('Invalid OKLCH');
    expect(() => oklchToHex('')).toThrow('Invalid OKLCH');
  });
});

describe('emailTheme (derived from styles.css)', () => {
  const css = readFileSync(join(import.meta.dir, '../styles.css'), 'utf8');

  it('styles.css contains --primary as oklch', () => {
    expect(extractCssVar(css, '--primary')).toMatch(/^oklch/);
  });

  it('primary converts to valid hex', () => {
    const val = extractCssVar(css, '--primary');
    expect(val).not.toBeNull();
    expect(oklchToHex(val!)).toMatch(HEX_RE);
  });

  it('primary-foreground converts to valid hex', () => {
    const val = extractCssVar(css, '--primary-foreground');
    expect(val).not.toBeNull();
    expect(oklchToHex(val!)).toMatch(HEX_RE);
  });

  it('primary is not the fallback color', () => {
    const val = extractCssVar(css, '--primary');
    expect(oklchToHex(val!)).not.toBe('#111827');
  });
});
