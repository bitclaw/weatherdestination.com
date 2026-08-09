import { describe, expect, it } from 'bun:test';
import { getSetting, setSetting } from '@/lib/db/settings-helpers.server';
import { makeTestDb } from '@/test/db';
import {
  HIDDEN_SIDEBAR_ITEMS_KEY,
  parseHiddenUrls
} from './sidebar-preferences.queries';

// Exercises the persistence contract getSidebarPreferencesFn/
// updateSidebarPreferencesFn rely on: a JSON array of hidden item urls,
// defaulting to empty (nothing hidden) when unset.

describe('sidebar preferences persistence', () => {
  it('defaults to no hidden items when unset', () => {
    const db = makeTestDb();
    expect(getSetting(db, HIDDEN_SIDEBAR_ITEMS_KEY)).toBeNull();
  });

  it('persists a hidden-items list and reads it back', () => {
    const db = makeTestDb();
    setSetting(
      db,
      HIDDEN_SIDEBAR_ITEMS_KEY,
      JSON.stringify(['/dashboard/apps', '/dashboard/notes'])
    );

    const raw = getSetting(db, HIDDEN_SIDEBAR_ITEMS_KEY);
    expect(JSON.parse(raw!)).toEqual(['/dashboard/apps', '/dashboard/notes']);
  });

  it('overwrites a previous list on repeated writes', () => {
    const db = makeTestDb();
    setSetting(
      db,
      HIDDEN_SIDEBAR_ITEMS_KEY,
      JSON.stringify(['/dashboard/apps'])
    );
    setSetting(db, HIDDEN_SIDEBAR_ITEMS_KEY, JSON.stringify([]));

    const raw = getSetting(db, HIDDEN_SIDEBAR_ITEMS_KEY);
    expect(JSON.parse(raw!)).toEqual([]);
  });

  it('parseHiddenUrls defaults to empty on malformed input', () => {
    expect(parseHiddenUrls(null)).toEqual([]);
    expect(parseHiddenUrls('not json')).toEqual([]);
    expect(parseHiddenUrls(JSON.stringify({ not: 'an array' }))).toEqual([]);
    expect(parseHiddenUrls(JSON.stringify('a string, not array'))).toEqual([]);
  });

  it('parseHiddenUrls filters non-string entries from a mixed-type array', () => {
    expect(parseHiddenUrls(JSON.stringify(['/a', 42, null, '/b', {}]))).toEqual(
      ['/a', '/b']
    );
  });
});
