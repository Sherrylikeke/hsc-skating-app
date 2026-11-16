CREATE TABLE `hsc_calendar_subscriptions` (
	`member_id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`auth_version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_calendar_subscription_hash` ON `hsc_calendar_subscriptions` (`hash`);
