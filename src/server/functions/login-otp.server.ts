import { eq } from 'drizzle-orm';
import type { db as sharedDb } from '@/lib/db';
import { users } from '@/lib/db/schema';

// .toLowerCase() only, no .trim() - matches better-auth's own OTP-route
// normalization exactly.
export async function shouldSendLoginOtp(
  db: typeof sharedDb,
  email: string
): Promise<boolean> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase())
  });
  return !!existing;
}
