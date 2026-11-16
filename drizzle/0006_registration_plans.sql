CREATE TABLE `hsc_registration_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`event_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_registration_plan_member_skater_event` ON `hsc_registration_plans` (`member_id`,`skater_id`,`event_id`);
