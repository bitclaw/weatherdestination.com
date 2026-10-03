import type { TimestampColumns } from './timestamp-guards';

// Every INTEGER column in the per-user DB, classified. Timestamps get guard
// triggers (timestamp-guards.ts); the rest are listed so the coverage test
// can require every new integer column to be classified one way or the
// other, instead of guessing from its name.
export const USER_DB_TIMESTAMP_COLUMNS: TimestampColumns = {
  _warpkit_migrations: ['applied_at'],
  user_events: ['created_at'],
  conversations: ['created_at', 'updated_at'],
  chat_messages: ['created_at'],
  feature_requests: ['created_at', 'updated_at'],
  notifications: ['created_at'],
  notes: ['created_at', 'updated_at'],
  files: ['created_at'],
  settings: ['updated_at'],
  api_keys: ['last_used_at', 'created_at']
};

export const USER_DB_NON_TIMESTAMP_INTEGERS: TimestampColumns = {
  notifications: ['read'],
  notes: ['pinned'],
  files: ['size']
};
