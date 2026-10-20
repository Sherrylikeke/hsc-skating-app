CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coach_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`skater_id` text NOT NULL,
	`event_id` text NOT NULL,
	`meeting_time` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history_records` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `live_events` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`hash` text NOT NULL,
	`checked_at` text NOT NULL
);
