CREATE TABLE `hsc_auth_account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `hsc_auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hsc_auth_account_user` ON `hsc_auth_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `hsc_auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `hsc_auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_auth_session_token_unique` ON `hsc_auth_session` (`token`);--> statement-breakpoint
CREATE INDEX `hsc_auth_session_user` ON `hsc_auth_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `hsc_auth_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`username` text,
	`display_username` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_auth_user_email_unique` ON `hsc_auth_user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_auth_user_username_unique` ON `hsc_auth_user` (`username`);--> statement-breakpoint
CREATE TABLE `hsc_auth_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hsc_auth_verification_identifier` ON `hsc_auth_verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `hsc_auth_links` (
	`auth_user_id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `hsc_auth_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `hsc_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hsc_reminder_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`arrival_minutes` integer DEFAULT 90 NOT NULL,
	`notify_minutes` integer DEFAULT 180 NOT NULL,
	`packing` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hsc_reminder_member` ON `hsc_reminder_rules` (`member_id`);