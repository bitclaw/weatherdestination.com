import { describe, expect, it } from 'bun:test';
import { isChunkLoadError, isTrackedAssetFailure } from './chunk-reload-guard';

describe('isChunkLoadError', () => {
  it('matches known dynamic-import failure messages', () => {
    expect(
      isChunkLoadError('Failed to fetch dynamically imported module')
    ).toBe(true);
    expect(isChunkLoadError('Loading chunk 42 failed')).toBe(true);
    expect(isChunkLoadError('Importing a module script failed')).toBe(true);
  });

  it('does not match unrelated messages', () => {
    expect(isChunkLoadError('TypeError: x is not a function')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('isTrackedAssetFailure', () => {
  const origin = 'https://weatherdestination.com';

  it('matches a same-origin hashed asset path', () => {
    expect(
      isTrackedAssetFailure(
        'https://weatherdestination.com/assets/entry-abc123.js',
        origin
      )
    ).toBe(true);
    expect(isTrackedAssetFailure('/assets/entry-abc123.js', origin)).toBe(true);
  });

  it('does not match a third-party script', () => {
    expect(
      isTrackedAssetFailure('https://client.crisp.chat/l.js', origin)
    ).toBe(false);
  });

  it('does not match a same-origin path outside /assets/', () => {
    expect(
      isTrackedAssetFailure(
        'https://weatherdestination.com/favicon.ico',
        origin
      )
    ).toBe(false);
  });

  it('does not match a cross-origin /assets/ path on a different host', () => {
    expect(
      isTrackedAssetFailure('https://evil.example.com/assets/entry.js', origin)
    ).toBe(false);
  });

  it('does not throw on a malformed URL', () => {
    expect(isTrackedAssetFailure('not a url::', origin)).toBe(false);
  });
});
