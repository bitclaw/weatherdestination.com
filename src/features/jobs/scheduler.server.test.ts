import { describe, expect, it } from 'bun:test';
import { SCHEDULES } from './scheduler.server';

// Regression guard: account-deletion reconciliation used to only run once,
// at boot (src/start.ts). A permanently-failed deletion (e.g. Stripe down)
// stayed stuck billing an already-deleted user until the next restart. This
// entry is what makes it retry periodically instead - if a future refactor
// drops it, nothing else in the test suite would catch that.
describe('SCHEDULES', () => {
  it('includes the account-deletion reconciliation cron', () => {
    const entry = SCHEDULES.find(s => s.type === 'account:reconcile-deletions');
    expect(entry).toBeDefined();
    expect(entry?.cron).toBe('*/15 * * * *');
  });
});
