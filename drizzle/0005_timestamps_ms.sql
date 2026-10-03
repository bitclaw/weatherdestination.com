-- Shared-DB timestamps move from Drizzle mode 'timestamp' (seconds) to
-- 'timestamp_ms' (docs/warpkit/patterns/timestamps.md). One UPDATE per table
-- converts all its timestamp columns together (the guard triggers check every
-- column of a row). Only values strictly between 0 and 1e11 are multiplied:
-- a value already in ms is left alone, so nothing can be doubled.
UPDATE `account_deletion_jobs` SET
  "stripe_cancelled_at" = CASE WHEN typeof("stripe_cancelled_at") = 'integer' AND "stripe_cancelled_at" > 0 AND "stripe_cancelled_at" < 100000000000 THEN "stripe_cancelled_at" * 1000 ELSE "stripe_cancelled_at" END,
  "stripe_deleted_at" = CASE WHEN typeof("stripe_deleted_at") = 'integer' AND "stripe_deleted_at" > 0 AND "stripe_deleted_at" < 100000000000 THEN "stripe_deleted_at" * 1000 ELSE "stripe_deleted_at" END,
  "files_deleted_at" = CASE WHEN typeof("files_deleted_at") = 'integer' AND "files_deleted_at" > 0 AND "files_deleted_at" < 100000000000 THEN "files_deleted_at" * 1000 ELSE "files_deleted_at" END,
  "user_db_deleted_at" = CASE WHEN typeof("user_db_deleted_at") = 'integer' AND "user_db_deleted_at" > 0 AND "user_db_deleted_at" < 100000000000 THEN "user_db_deleted_at" * 1000 ELSE "user_db_deleted_at" END,
  "shared_user_deleted_at" = CASE WHEN typeof("shared_user_deleted_at") = 'integer' AND "shared_user_deleted_at" > 0 AND "shared_user_deleted_at" < 100000000000 THEN "shared_user_deleted_at" * 1000 ELSE "shared_user_deleted_at" END,
  "completed_at" = CASE WHEN typeof("completed_at") = 'integer' AND "completed_at" > 0 AND "completed_at" < 100000000000 THEN "completed_at" * 1000 ELSE "completed_at" END,
  "last_attempt_at" = CASE WHEN typeof("last_attempt_at") = 'integer' AND "last_attempt_at" > 0 AND "last_attempt_at" < 100000000000 THEN "last_attempt_at" * 1000 ELSE "last_attempt_at" END,
  "lease_expires_at" = CASE WHEN typeof("lease_expires_at") = 'integer' AND "lease_expires_at" > 0 AND "lease_expires_at" < 100000000000 THEN "lease_expires_at" * 1000 ELSE "lease_expires_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
--> statement-breakpoint
UPDATE `accounts` SET
  "access_token_expires_at" = CASE WHEN typeof("access_token_expires_at") = 'integer' AND "access_token_expires_at" > 0 AND "access_token_expires_at" < 100000000000 THEN "access_token_expires_at" * 1000 ELSE "access_token_expires_at" END,
  "refresh_token_expires_at" = CASE WHEN typeof("refresh_token_expires_at") = 'integer' AND "refresh_token_expires_at" > 0 AND "refresh_token_expires_at" < 100000000000 THEN "refresh_token_expires_at" * 1000 ELSE "refresh_token_expires_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
--> statement-breakpoint
UPDATE `admin_audit_log` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `cities` SET
  "data_last_updated" = CASE WHEN typeof("data_last_updated") = 'integer' AND "data_last_updated" > 0 AND "data_last_updated" < 100000000000 THEN "data_last_updated" * 1000 ELSE "data_last_updated" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `feature_flags` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
--> statement-breakpoint
UPDATE `feature_request_votes` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `feature_requests` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
--> statement-breakpoint
UPDATE `leads` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `mrr_snapshots` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `payments` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `purchases` SET
  "refunded_at" = CASE WHEN typeof("refunded_at") = 'integer' AND "refunded_at" > 0 AND "refunded_at" < 100000000000 THEN "refunded_at" * 1000 ELSE "refunded_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `rate_limit_events` SET
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `sessions` SET
  "expires_at" = CASE WHEN typeof("expires_at") = 'integer' AND "expires_at" > 0 AND "expires_at" < 100000000000 THEN "expires_at" * 1000 ELSE "expires_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
--> statement-breakpoint
UPDATE `subscriptions` SET
  "current_period_end" = CASE WHEN typeof("current_period_end") = 'integer' AND "current_period_end" > 0 AND "current_period_end" < 100000000000 THEN "current_period_end" * 1000 ELSE "current_period_end" END,
  "trial_ends_at" = CASE WHEN typeof("trial_ends_at") = 'integer' AND "trial_ends_at" > 0 AND "trial_ends_at" < 100000000000 THEN "trial_ends_at" * 1000 ELSE "trial_ends_at" END,
  "last_synced_at" = CASE WHEN typeof("last_synced_at") = 'integer' AND "last_synced_at" > 0 AND "last_synced_at" < 100000000000 THEN "last_synced_at" * 1000 ELSE "last_synced_at" END,
  "cancelled_at" = CASE WHEN typeof("cancelled_at") = 'integer' AND "cancelled_at" > 0 AND "cancelled_at" < 100000000000 THEN "cancelled_at" * 1000 ELSE "cancelled_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
--> statement-breakpoint
UPDATE `trial_abuse_markers` SET
  "deleted_at" = CASE WHEN typeof("deleted_at") = 'integer' AND "deleted_at" > 0 AND "deleted_at" < 100000000000 THEN "deleted_at" * 1000 ELSE "deleted_at" END,
  "expires_at" = CASE WHEN typeof("expires_at") = 'integer' AND "expires_at" > 0 AND "expires_at" < 100000000000 THEN "expires_at" * 1000 ELSE "expires_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END;
--> statement-breakpoint
UPDATE `two_factor` SET
  "locked_until" = CASE WHEN typeof("locked_until") = 'integer' AND "locked_until" > 0 AND "locked_until" < 100000000000 THEN "locked_until" * 1000 ELSE "locked_until" END;
--> statement-breakpoint
UPDATE `users` SET
  "deletion_pending_at" = CASE WHEN typeof("deletion_pending_at") = 'integer' AND "deletion_pending_at" > 0 AND "deletion_pending_at" < 100000000000 THEN "deletion_pending_at" * 1000 ELSE "deletion_pending_at" END,
  "ban_expires" = CASE WHEN typeof("ban_expires") = 'integer' AND "ban_expires" > 0 AND "ban_expires" < 100000000000 THEN "ban_expires" * 1000 ELSE "ban_expires" END,
  "reengagement_sent_at" = CASE WHEN typeof("reengagement_sent_at") = 'integer' AND "reengagement_sent_at" > 0 AND "reengagement_sent_at" < 100000000000 THEN "reengagement_sent_at" * 1000 ELSE "reengagement_sent_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
--> statement-breakpoint
UPDATE `verifications` SET
  "expires_at" = CASE WHEN typeof("expires_at") = 'integer' AND "expires_at" > 0 AND "expires_at" < 100000000000 THEN "expires_at" * 1000 ELSE "expires_at" END,
  "created_at" = CASE WHEN typeof("created_at") = 'integer' AND "created_at" > 0 AND "created_at" < 100000000000 THEN "created_at" * 1000 ELSE "created_at" END,
  "updated_at" = CASE WHEN typeof("updated_at") = 'integer' AND "updated_at" > 0 AND "updated_at" < 100000000000 THEN "updated_at" * 1000 ELSE "updated_at" END;
