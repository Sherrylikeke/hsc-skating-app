CREATE TABLE `coach_assignments` (
	`skater_id` text PRIMARY KEY NOT NULL,
	`coach` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
