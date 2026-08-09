import { describe, expect, it } from 'bun:test';
import {
  hasUsedTrialBefore,
  recordTrialAbuseMarker
} from '@/lib/operations/trial-abuse.server';
import { makeTestSharedDb } from '@/test/db';

describe('trial abuse markers', () => {
  it('reports no prior trial for an email with no marker', async () => {
    const db = makeTestSharedDb();
    expect(await hasUsedTrialBefore('nobody@example.com', db)).toBe(false);
  });

  it('reports a prior trial after a marker is recorded', async () => {
    const db = makeTestSharedDb();
    db.transaction(tx => {
      recordTrialAbuseMarker(tx, 'deleted@example.com');
    });
    expect(await hasUsedTrialBefore('deleted@example.com', db)).toBe(true);
  });

  it('is case- and whitespace-insensitive', async () => {
    const db = makeTestSharedDb();
    db.transaction(tx => {
      recordTrialAbuseMarker(tx, '  Mixed.Case@Example.com  ');
    });
    expect(await hasUsedTrialBefore('mixed.case@example.com', db)).toBe(true);
  });

  it('does not match a different email', async () => {
    const db = makeTestSharedDb();
    db.transaction(tx => {
      recordTrialAbuseMarker(tx, 'deleted@example.com');
    });
    expect(await hasUsedTrialBefore('other@example.com', db)).toBe(false);
  });

  it('re-recording the same email updates the marker instead of erroring', async () => {
    const db = makeTestSharedDb();
    db.transaction(tx => {
      recordTrialAbuseMarker(tx, 'repeat@example.com');
      recordTrialAbuseMarker(tx, 'repeat@example.com');
    });
    expect(await hasUsedTrialBefore('repeat@example.com', db)).toBe(true);
  });
});
