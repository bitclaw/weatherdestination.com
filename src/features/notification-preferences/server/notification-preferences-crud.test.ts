import { describe, expect, it } from 'bun:test';
import { getSetting, setSetting } from '@/lib/db/settings-helpers.server';
import { makeTestDb } from '@/test/db';
import {
  isMarketingEmailsEnabled,
  MARKETING_EMAILS_KEY
} from './notification-preferences.queries';

// Exercises the exact key/default-semantics contract getNotificationPreferencesFn
// and withEmailPreferenceGate both rely on: unset means opted in.

describe('notification preferences persistence', () => {
  it('defaults to opted-in when no setting row exists', () => {
    const db = makeTestDb();
    expect(getSetting(db, MARKETING_EMAILS_KEY)).toBeNull();
    expect(isMarketingEmailsEnabled(getSetting(db, MARKETING_EMAILS_KEY))).toBe(
      true
    );
  });

  it('persists an opt-out and reads it back', () => {
    const db = makeTestDb();
    setSetting(db, MARKETING_EMAILS_KEY, '0');
    expect(getSetting(db, MARKETING_EMAILS_KEY)).toBe('0');
    expect(isMarketingEmailsEnabled(getSetting(db, MARKETING_EMAILS_KEY))).toBe(
      false
    );
  });

  it('persists an explicit opt-in and reads it back', () => {
    const db = makeTestDb();
    setSetting(db, MARKETING_EMAILS_KEY, '1');
    expect(getSetting(db, MARKETING_EMAILS_KEY)).toBe('1');
    expect(isMarketingEmailsEnabled(getSetting(db, MARKETING_EMAILS_KEY))).toBe(
      true
    );
  });

  it('overwrites a previous value on repeated writes', () => {
    const db = makeTestDb();
    setSetting(db, MARKETING_EMAILS_KEY, '1');
    setSetting(db, MARKETING_EMAILS_KEY, '0');
    expect(getSetting(db, MARKETING_EMAILS_KEY)).toBe('0');
  });

  it('isMarketingEmailsEnabled treats null and non-"0" as enabled', () => {
    expect(isMarketingEmailsEnabled(null)).toBe(true);
    expect(isMarketingEmailsEnabled('1')).toBe(true);
    expect(isMarketingEmailsEnabled('garbage')).toBe(true);
    expect(isMarketingEmailsEnabled('0')).toBe(false);
  });
});
