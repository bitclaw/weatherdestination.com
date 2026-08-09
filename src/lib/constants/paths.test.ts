import { describe, expect, it } from 'bun:test';
import { sanitizeRedirectPath } from './paths';

describe('sanitizeRedirectPath', () => {
  it('allows a plain relative path', () => {
    expect(sanitizeRedirectPath('/dashboard')).toBe('/dashboard');
  });

  it('allows a relative path with a query string', () => {
    expect(sanitizeRedirectPath('/dashboard/billing?tab=history')).toBe(
      '/dashboard/billing?tab=history'
    );
  });

  it('rejects undefined', () => {
    expect(sanitizeRedirectPath(undefined)).toBeUndefined();
  });

  it('rejects an empty string', () => {
    expect(sanitizeRedirectPath('')).toBeUndefined();
  });

  it('rejects a value with no leading slash', () => {
    expect(sanitizeRedirectPath('dashboard')).toBeUndefined();
  });

  it('rejects a protocol-relative URL', () => {
    expect(sanitizeRedirectPath('//evil.com')).toBeUndefined();
  });

  it('rejects an absolute URL', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBeUndefined();
  });

  it('rejects the backslash-normalization bypass', () => {
    expect(sanitizeRedirectPath('/\\evil.com')).toBeUndefined();
  });

  it('rejects a backslash appearing later in the value', () => {
    expect(sanitizeRedirectPath('/dashboard\\evil.com')).toBeUndefined();
  });

  it('rejects percent-encoded slash', () => {
    expect(sanitizeRedirectPath('/%2f%2fevil.com')).toBeUndefined();
  });

  it('rejects percent-encoded backslash', () => {
    expect(sanitizeRedirectPath('/%5cevil.com')).toBeUndefined();
  });
});
