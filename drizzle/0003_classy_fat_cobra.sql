CREATE TABLE `rate_limit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_events_key_created_idx` ON `rate_limit_events` (`key`,`created_at`);