import { describe, expect, it } from 'bun:test';
import {
  adminFailedJobsPrefixKey,
  adminFailedJobsQueryKey,
  adminJobStatsQueryKey,
  adminJobsListPrefixKey,
  adminJobsQueryKey,
  adminJobTypesQueryKey,
  adminSchedulesQueryKey,
  adminUsersQueryKey,
  apiKeysQueryKey,
  auditLogQueryKey,
  bootstrapQueryKey,
  conversationMessagesQueryKey,
  conversationsQueryKey,
  creditsQueryKey,
  deviceSessionsQueryKey,
  featureFlagQueryKey,
  featureFlagsQueryKey,
  featureRequestsQueryKey,
  noteDetailQueryKey,
  notesQueryKey,
  notificationPreferencesQueryKey,
  notificationsQueryKey,
  oneTimePurchaseQueryKey,
  sidebarPreferencesQueryKey,
  subscriptionQueryKey,
  uploadsQueryKey
} from './query-keys';

// Regression guard: a segment-order/count change here would silently break
// invalidateQueries call sites elsewhere with no type error, since query keys
// are plain arrays. Pin the exact shape of every factory's output.
describe('query key factories', () => {
  it('produce stable, order-sensitive shapes with no args', () => {
    expect(bootstrapQueryKey()).toEqual(['bootstrap']);
    expect(apiKeysQueryKey()).toEqual(['api-keys']);
    expect(featureRequestsQueryKey()).toEqual(['feature-requests']);
    expect(auditLogQueryKey()).toEqual(['audit-log']);
    expect(conversationsQueryKey()).toEqual(['conversations']);
    expect(featureFlagsQueryKey()).toEqual(['feature-flags']);
    expect(notificationsQueryKey()).toEqual(['notifications']);
    expect(subscriptionQueryKey()).toEqual(['subscription']);
    expect(notesQueryKey()).toEqual(['notes']);
    expect(uploadsQueryKey()).toEqual(['uploads']);
    expect(creditsQueryKey()).toEqual(['credits']);
    expect(adminUsersQueryKey()).toEqual(['admin', 'users']);
    expect(adminJobStatsQueryKey()).toEqual(['admin', 'jobs', 'stats']);
    expect(adminJobsListPrefixKey()).toEqual(['admin', 'jobs', 'list']);
    expect(adminFailedJobsPrefixKey()).toEqual(['admin', 'jobs', 'failed']);
    expect(adminJobTypesQueryKey()).toEqual(['admin', 'job-types']);
    expect(adminSchedulesQueryKey()).toEqual(['admin', 'schedules']);
    expect(oneTimePurchaseQueryKey()).toEqual(['one-time-purchase']);
    expect(deviceSessionsQueryKey()).toEqual(['device-sessions']);
    expect(notificationPreferencesQueryKey()).toEqual([
      'notification-preferences'
    ]);
    expect(sidebarPreferencesQueryKey()).toEqual(['sidebar-preferences']);
  });

  it('produce stable shapes with args, in declared order', () => {
    expect(conversationMessagesQueryKey('conv_1')).toEqual([
      'conversation-messages',
      'conv_1'
    ]);
    expect(featureFlagQueryKey('my_flag')).toEqual([
      'feature-flags',
      'my_flag'
    ]);
    expect(noteDetailQueryKey('note_1')).toEqual(['notes', 'note_1']);
  });

  it('adminJobsQueryKey keeps status/type/limit/offset in that order, prefix-compatible with adminJobsListPrefixKey', () => {
    const key = adminJobsQueryKey('active', 'email:welcome', 10, 0);
    expect(key).toEqual([
      'admin',
      'jobs',
      'list',
      'active',
      'email:welcome',
      10,
      0
    ]);
    expect(key.slice(0, 3)).toEqual([...adminJobsListPrefixKey()]);
  });

  it('adminJobsQueryKey with undefined filters still starts with the prefix', () => {
    const key = adminJobsQueryKey(undefined, undefined, 10, 0);
    expect(key).toEqual(['admin', 'jobs', 'list', undefined, undefined, 10, 0]);
    expect(key.slice(0, 3)).toEqual([...adminJobsListPrefixKey()]);
  });

  it('adminFailedJobsQueryKey keeps type/limit/offset in that order, prefix-compatible with adminFailedJobsPrefixKey', () => {
    const key = adminFailedJobsQueryKey('email:welcome', 10, 0);
    expect(key).toEqual(['admin', 'jobs', 'failed', 'email:welcome', 10, 0]);
    expect(key.slice(0, 3)).toEqual([...adminFailedJobsPrefixKey()]);
  });
});
