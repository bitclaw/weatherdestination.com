CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`state_code` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`population` integer,
	`wildfire_risk` integer NOT NULL,
	`flood_risk` integer NOT NULL,
	`hurricane_risk` integer NOT NULL,
	`heat_wave_risk` integer NOT NULL,
	`drought_risk` integer NOT NULL,
	`avg_sunshine_hours` real NOT NULL,
	`avg_cloud_cover` real NOT NULL,
	`avg_temp_high` real NOT NULL,
	`avg_temp_low` real NOT NULL,
	`cost_of_living_index` real,
	`air_quality_index` integer,
	`data_last_updated` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cities_name_state_code_idx` ON `cities` (`name`,`state_code`);--> statement-breakpoint
CREATE INDEX `cities_wildfire_risk_idx` ON `cities` (`wildfire_risk`);--> statement-breakpoint
CREATE INDEX `cities_flood_risk_idx` ON `cities` (`flood_risk`);