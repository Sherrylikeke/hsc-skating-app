CREATE UNIQUE INDEX `hsc_pending_claim_member` ON `hsc_claims` (`member_id`) WHERE "hsc_claims"."status"='pending';--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_invite_hash` ON `hsc_invites` (`hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_pending_invite_email` ON `hsc_invites` (`email`) WHERE "hsc_invites"."status"='pending';--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_member_email` ON `hsc_members` (`email`);--> statement-breakpoint
CREATE INDEX `hsc_notification_member` ON `hsc_notifications` (`member_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_notification_delivery` ON `hsc_notifications` (`outbox_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `hsc_outbox_due` ON `hsc_outbox` (`state`,`available_at`);--> statement-breakpoint
CREATE INDEX `hsc_receipt_requirement` ON `hsc_receipts` (`requirement_id`);--> statement-breakpoint
CREATE INDEX `hsc_relation_member` ON `hsc_relations` (`member_id`,`active`);--> statement-breakpoint
CREATE INDEX `hsc_relation_skater` ON `hsc_relations` (`skater_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `hsc_skater_single_account_binding` ON `hsc_relations` (`member_id`) WHERE "hsc_relations"."kind"='skater' AND "hsc_relations"."active"=1;--> statement-breakpoint
CREATE INDEX `hsc_session_member` ON `hsc_sessions` (`member_id`);