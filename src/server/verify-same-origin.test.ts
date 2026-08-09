import { describe, expect, it } from 'bun:test';
import { isSameOriginRequest } from './verify-same-origin';

const req = (headers: Record<string, string>) =>
  new Request('http://localhost/api/v1/ai-chat', { method: 'POST', headers });

describe('isSameOriginRequest', () => {
  it('allows Sec-Fetch-Site: same-origin', () => {
    expect(req({ 'Sec-Fetch-Site': 'same-origin' })).toSatisfy(r =>
      isSameOriginRequest(r)
    );
  });

  it('rejects Sec-Fetch-Site: cross-site even if Origin matches', () => {
    expect(
      isSameOriginRequest(
        req({ 'Sec-Fetch-Site': 'cross-site', Origin: 'http://localhost' })
      )
    ).toBe(false);
  });

  it('allows a matching Origin header when Sec-Fetch-Site is absent', () => {
    expect(isSameOriginRequest(req({ Origin: 'http://localhost' }))).toBe(true);
  });

  it('rejects a non-matching Origin header', () => {
    expect(
      isSameOriginRequest(req({ Origin: 'https://evil.example.com' }))
    ).toBe(false);
  });

  it('falls back to a matching Referer when Origin is absent', () => {
    expect(
      isSameOriginRequest(
        req({ Referer: 'http://localhost/dashboard/settings' })
      )
    ).toBe(true);
  });

  it('rejects a non-matching Referer', () => {
    expect(
      isSameOriginRequest(req({ Referer: 'https://evil.example.com/' }))
    ).toBe(false);
  });

  it('rejects a request with none of the three headers', () => {
    expect(isSameOriginRequest(req({}))).toBe(false);
  });

  it('rejects an unparseable Referer', () => {
    expect(isSameOriginRequest(req({ Referer: 'not a url' }))).toBe(false);
  });
});
