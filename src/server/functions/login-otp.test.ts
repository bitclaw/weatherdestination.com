import { describe, expect, it } from 'bun:test';
import { users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeUser } from '@/test/fixtures';
import { shouldSendLoginOtp } from './login-otp.server';

describe('shouldSendLoginOtp', () => {
  it('returns true for a known email', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ email: 'known@example.com' });
    await db.insert(users).values(user);
    expect(await shouldSendLoginOtp(db, 'known@example.com')).toBe(true);
  });

  it('normalizes case the same way better-auth does', async () => {
    const db = makeTestSharedDb();
    const user = makeUser({ email: 'known@example.com' });
    await db.insert(users).values(user);
    expect(await shouldSendLoginOtp(db, 'Known@Example.com')).toBe(true);
  });

  it('returns false for an unknown email', async () => {
    const db = makeTestSharedDb();
    expect(await shouldSendLoginOtp(db, 'nobody@example.com')).toBe(false);
  });
});
