import { describe, expect, test } from 'bun:test';
import { buildCsp } from '@/server/csp';

describe('buildCsp', () => {
  test('production build omits unsafe-eval and blob:, adds frame-ancestors', () => {
    const csp = buildCsp(true);

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('blob:');
  });

  test('non-production build allows unsafe-eval and worker blob:, omits frame-ancestors', () => {
    const csp = buildCsp(false);

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).not.toContain('frame-ancestors');
  });

  test('always allow-lists the third-party origins this app uses', () => {
    const csp = buildCsp(true);

    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toContain('https://static.cloudflareinsights.com');
    expect(csp).toContain('https://www.clarity.ms');
    expect(csp).toContain('https://scripts.clarity.ms');
    expect(csp).toContain('https://client.crisp.chat');
    expect(csp).toContain('https://cloud.umami.is');
    expect(csp).toContain('https://gateway.umami.is');
    expect(csp).toContain('https://*.sentry.io');
  });
});
