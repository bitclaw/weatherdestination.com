CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`admin_user_id` text NOT NULL,
	`target_user_id` text,
	`payload` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_admin_idx` ON `admin_audit_log` (`admin_user_id`);