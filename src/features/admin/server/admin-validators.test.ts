import { describe, expect, it } from 'bun:test';
import { userIdSchema } from './admin.mutations';

// Adversarial tests for the admin userId validator. better-auth's default
// generateId() produces a 32-char alphanumeric string (not a UUID), so
// userIdSchema must accept that shape while still rejecting anything with
// path-traversal / injection characters.

const maliciousInputs = [
  '../etc/passwd',
  '..\\windows\\system32',
  '<script>alert(1)</script>',
  "'; DROP TABLE users; --",
  'has spaces',
  ''
];

const validUserIds = [
  '01970b4b1234abcdef0000000000001a',
  'f47ac10b58cc4372a5670e02b2c3d479'
];

describe('admin userId schema', () => {
  it('rejects path traversal and injection strings', () => {
    for (const input of maliciousInputs) {
      expect(userIdSchema.safeParse(input).success).toBe(false);
    }
  });

  it('accepts real better-auth-shaped IDs (32-char alphanumeric)', () => {
    for (const input of validUserIds) {
      expect(userIdSchema.safeParse(input).success).toBe(true);
    }
  });
});
