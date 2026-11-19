CREATE TABLE `hsc_portal_cart` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`item_id` text NOT NULL,
	`skater_id` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_portal_cart_owner_item` ON `hsc_portal_cart` (`member_id`,`item_id`,`skater_id`);--> statement-breakpoint
CREATE TABLE `hsc_portal_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`department` text NOT NULL,
	`message` text NOT NULL,
	`state` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_portal_editors` (
	`member_id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_portal_media` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_portal_pages` (
	`path` text PRIMARY KEY NOT NULL,
	`published` text,
	`draft` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`operation_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hsc_portal_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`revision` integer NOT NULL,
	`content` text NOT NULL,
	`published` integer NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_portal_version` ON `hsc_portal_versions` (`path`,`revision`);