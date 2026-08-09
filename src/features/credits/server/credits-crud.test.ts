import { describe, expect, it } from 'bun:test';
import { users } from '@/lib/db/schema';
import { makeTestSharedDb } from '@/test/db';
import { makeUser as makeUserRow } from '@/test/fixtures';
import {
  addCredits,
  deductCredit,
  getCredits,
  refundCredit
} from './credits.server';

describe('credits.server', () => {
  const makeUser = async (db: ReturnType<typeof makeTestSharedDb>) => {
    const user = makeUserRow({ credits: 0 });
    await db.insert(users).values(user);
    return user.id;
  };

  it('getCredits returns 0 for new users', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    const credits = await getCredits(db, id);
    expect(credits).toBe(0);
  });

  it('addCredits increases balance', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    await addCredits(db, id, 10);
    expect(await getCredits(db, id)).toBe(10);
  });

  it('addCredits is additive', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    await addCredits(db, id, 5);
    await addCredits(db, id, 3);
    expect(await getCredits(db, id)).toBe(8);
  });

  it('deductCredit reduces balance and returns remaining', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    await addCredits(db, id, 5);

    const result = await deductCredit(db, id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.remaining).toBe(4);
    expect(await getCredits(db, id)).toBe(4);
  });

  it('deductCredit returns false when balance is 0', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    await addCredits(db, id, 1);

    const first = await deductCredit(db, id);
    expect(first.ok).toBe(true);

    const second = await deductCredit(db, id);
    expect(second.ok).toBe(false);
  });

  it('deductCredit never goes below zero', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    await addCredits(db, id, 1);

    await deductCredit(db, id);
    await deductCredit(db, id);
    await deductCredit(db, id);

    expect(await getCredits(db, id)).toBe(0);
  });

  it('deductCredit for nonexistent user returns false', async () => {
    const db = makeTestSharedDb();
    const result = await deductCredit(db, 'nonexistent');
    expect(result.ok).toBe(false);
  });

  it('concurrent deductions on balance=1 , exactly one succeeds', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    await addCredits(db, id, 1);
    const [r1, r2] = await Promise.all([
      deductCredit(db, id),
      deductCredit(db, id)
    ]);
    const successes = [r1, r2].filter(r => r.ok).length;
    expect(successes).toBe(1);
    expect(await getCredits(db, id)).toBe(0);
  });

  it('refundCredit undoes a deductCredit (default amount 1)', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);
    await addCredits(db, id, 5);

    const deducted = await deductCredit(db, id);
    expect(deducted.ok).toBe(true);
    expect(await getCredits(db, id)).toBe(4);

    await refundCredit(db, id);
    expect(await getCredits(db, id)).toBe(5);
  });

  it('refundCredit accepts an explicit amount', async () => {
    const db = makeTestSharedDb();
    const id = await makeUser(db);

    await refundCredit(db, id, 3);
    expect(await getCredits(db, id)).toBe(3);
  });
});
