CREATE TABLE `hsc_admissions` (
	`skater_id` text PRIMARY KEY NOT NULL,
	`admitted` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`subject_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`hash` text NOT NULL,
	`skater_ids` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text NOT NULL,
	`used_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`requested_role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`auth_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`outbox_id` text NOT NULL,
	`member_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`author_id` text,
	`payload` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`author_id` text,
	`payload` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text NOT NULL,
	`lease_until` text,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`requirement_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`member_id` text NOT NULL,
	`revision` integer NOT NULL,
	`read_at` text NOT NULL,
	`acknowledged_at` text
);
--> statement-breakpoint
CREATE TABLE `hsc_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`kind` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`approved_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_requirement_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`requirement_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`skater_ids` text NOT NULL,
	`event_id` text,
	`slot_key` text,
	`due_at` text,
	`state` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`auth_version` integer NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL
);
