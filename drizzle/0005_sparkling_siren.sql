CREATE TABLE `hsc_home_skaters` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`pinned` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hsc_home_member` ON `hsc_home_skaters` (`member_id`);