import {sqliteTable, text, integer, index, uniqueIndex} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const coachAssignments = sqliteTable('coach_assignments', {
  skaterId: text('skater_id').primaryKey(),
  coach: text('coach').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const appMeta = sqliteTable('app_meta',{key:text('key').primaryKey(),value:text('value').notNull()});
export const historyRecords = sqliteTable('history_records',{id:text('id').primaryKey(),eventId:text('event_id').notNull(),payload:text('payload').notNull()});
export const historyEvents = sqliteTable('history_events',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const liveEvents = sqliteTable('live_events',{id:text('id').primaryKey(),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()});
export const sourceRevisions = sqliteTable('source_revisions',{id:text('id').primaryKey(),eventId:text('event_id').notNull(),kind:text('kind').notNull(),url:text('url').notNull(),hash:text('hash').notNull(),checkedAt:text('checked_at').notNull()});
export const coachPlans = sqliteTable('coach_plans',{id:text('id').primaryKey(),skaterId:text('skater_id').notNull(),eventId:text('event_id').notNull(),meetingTime:text('meeting_time').notNull().default(''),note:text('note').notNull().default(''),revision:integer('revision').notNull().default(1)});
export const hscMembers = sqliteTable('hsc_members', {
  id: text('id').primaryKey(), email: text('email').notNull(), name: text('name').notNull(),
  role: text('role'), requestedRole: text('requested_role').notNull(), status: text('status').notNull().default('pending'),
  authVersion: integer('auth_version').notNull().default(1), createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('hsc_member_email').on(table.email)]);
export const hscSessions = sqliteTable('hsc_sessions', {
  hash: text('hash').primaryKey(), memberId: text('member_id').notNull(), authVersion: integer('auth_version').notNull(),
  expiresAt: text('expires_at').notNull(), revokedAt: text('revoked_at'), createdAt: text('created_at').notNull(),
}, table => [index('hsc_session_member').on(table.memberId)]);
export const hscAdmissions = sqliteTable('hsc_admissions', {
  skaterId: text('skater_id').primaryKey(), admitted: integer('admitted').notNull().default(0),
  payload: text('payload').notNull(), updatedBy: text('updated_by').notNull(), updatedAt: text('updated_at').notNull(),
});
export const hscRelations = sqliteTable('hsc_relations', {
  id: text('id').primaryKey(), memberId: text('member_id').notNull(), skaterId: text('skater_id').notNull(),
  kind: text('kind').notNull(), active: integer('active').notNull().default(1), approvedBy: text('approved_by').notNull(), updatedAt: text('updated_at').notNull(),
}, table => [index('hsc_relation_member').on(table.memberId, table.active), index('hsc_relation_skater').on(table.skaterId, table.active), uniqueIndex('hsc_skater_single_account_binding').on(table.memberId).where(sql`${table.kind}='skater' AND ${table.active}=1`)]);
export const hscInvites = sqliteTable('hsc_invites', {
  id: text('id').primaryKey(), email: text('email').notNull(), role: text('role').notNull(), hash: text('hash').notNull(),
  skaterIds: text('skater_ids').notNull(), expiresAt: text('expires_at').notNull(), status: text('status').notNull().default('pending'),
  createdBy: text('created_by').notNull(), usedBy: text('used_by'), createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('hsc_invite_hash').on(table.hash), uniqueIndex('hsc_pending_invite_email').on(table.email).where(sql`${table.status}='pending'`)]);
export const hscClaims = sqliteTable('hsc_claims', {
  id: text('id').primaryKey(), memberId: text('member_id').notNull(), kind: text('kind').notNull(),
  payload: text('payload').notNull(), status: text('status').notNull().default('pending'), reviewedBy: text('reviewed_by'), createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('hsc_pending_claim_member').on(table.memberId).where(sql`${table.status}='pending'`)]);
export const hscAudit = sqliteTable('hsc_audit', {
  id: text('id').primaryKey(), actorId: text('actor_id').notNull(), action: text('action').notNull(),
  subjectId: text('subject_id').notNull(), payload: text('payload').notNull(), createdAt: text('created_at').notNull(),
});
export const hscHomeSkaters = sqliteTable('hsc_home_skaters', {
  id: text('id').primaryKey(), memberId: text('member_id').notNull(), skaterId: text('skater_id').notNull(),
  pinned: integer('pinned').notNull(), updatedAt: text('updated_at').notNull(),
}, table => [index('hsc_home_member').on(table.memberId)]);
export const hscRateLimits = sqliteTable('hsc_rate_limits', {
  id: text('id').primaryKey(), count: integer('count').notNull().default(1), expiresAt: integer('expires_at').notNull(),
});
export const hscChanges = sqliteTable('hsc_changes', {
  id: text('id').primaryKey(), eventId: text('event_id').notNull(), skaterId: text('skater_id').notNull(),
  payload: text('payload').notNull(), createdAt: text('created_at').notNull(),
});
export const hscOutbox = sqliteTable('hsc_outbox', {
  id: text('id').primaryKey(), kind: text('kind').notNull(), subjectId: text('subject_id').notNull(),
  skaterId: text('skater_id').notNull(), authorId: text('author_id'), payload: text('payload').notNull(),
  state: text('state').notNull().default('pending'), attempts: integer('attempts').notNull().default(0),
  availableAt: text('available_at').notNull(), leaseUntil: text('lease_until'), error: text('error'), createdAt: text('created_at').notNull(),
}, table => [index('hsc_outbox_due').on(table.state, table.availableAt)]);
export const hscNotifications = sqliteTable('hsc_notifications', {
  id: text('id').primaryKey(), outboxId: text('outbox_id').notNull(), memberId: text('member_id').notNull(),
  skaterId: text('skater_id').notNull(), kind: text('kind').notNull(), subjectId: text('subject_id').notNull(),
  authorId: text('author_id'), payload: text('payload').notNull(), readAt: text('read_at'), createdAt: text('created_at').notNull(),
}, table => [index('hsc_notification_member').on(table.memberId, table.createdAt), uniqueIndex('hsc_notification_delivery').on(table.outboxId, table.memberId)]);
export const hscRequirements = sqliteTable('hsc_requirements', {
  id: text('id').primaryKey(), authorId: text('author_id').notNull(), title: text('title').notNull(), body: text('body').notNull(),
  skaterIds: text('skater_ids').notNull(), eventId: text('event_id'), slotKey: text('slot_key'), dueAt: text('due_at'),
  state: text('state').notNull().default('active'), revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const hscRequirementVersions = sqliteTable('hsc_requirement_versions', {
  id: text('id').primaryKey(), requirementId: text('requirement_id').notNull(), revision: integer('revision').notNull(),
  payload: text('payload').notNull(), actorId: text('actor_id').notNull(), createdAt: text('created_at').notNull(),
});
export const hscReceipts = sqliteTable('hsc_receipts', {
  id: text('id').primaryKey(), requirementId: text('requirement_id').notNull(), skaterId: text('skater_id').notNull(),
  memberId: text('member_id').notNull(), revision: integer('revision').notNull(), readAt: text('read_at').notNull(), acknowledgedAt: text('acknowledged_at'),
}, table => [index('hsc_receipt_requirement').on(table.requirementId)]);
export const authUser = sqliteTable('hsc_auth_user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', {mode:'boolean'}).notNull(), image: text('image'),
  createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(), updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
  username: text('username').unique(), displayUsername: text('display_username'),
});
export const authSession = sqliteTable('hsc_auth_session', {
  id: text('id').primaryKey(), expiresAt: integer('expires_at', {mode:'timestamp_ms'}).notNull(), token: text('token').notNull().unique(),
  createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(), updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'), userId: text('user_id').notNull().references(()=>authUser.id,{onDelete:'cascade'}),
}, table => [index('hsc_auth_session_user').on(table.userId)]);
export const authAccount = sqliteTable('hsc_auth_account', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(()=>authUser.id,{onDelete:'cascade'}), accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', {mode:'timestamp_ms'}), refreshTokenExpiresAt: integer('refresh_token_expires_at', {mode:'timestamp_ms'}),
  scope: text('scope'), password: text('password'), createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(), updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
}, table => [index('hsc_auth_account_user').on(table.userId)]);
export const authVerification = sqliteTable('hsc_auth_verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: integer('expires_at', {mode:'timestamp_ms'}).notNull(), createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(), updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
}, table => [index('hsc_auth_verification_identifier').on(table.identifier)]);
export const hscAuthLinks = sqliteTable('hsc_auth_links', {
  authUserId: text('auth_user_id').primaryKey().references(()=>authUser.id,{onDelete:'cascade'}),
  memberId: text('member_id').notNull().references(()=>hscMembers.id), createdAt: text('created_at').notNull(),
});
export const hscReminderRules = sqliteTable('hsc_reminder_rules', {
  id:text('id').primaryKey(), memberId:text('member_id').notNull(), skaterId:text('skater_id').notNull(),
  arrivalMinutes:integer('arrival_minutes').notNull().default(90), notifyMinutes:integer('notify_minutes').notNull().default(180),
  packing:text('packing').notNull(), enabled:integer('enabled').notNull().default(1),
  revision:integer('revision').notNull().default(1), updatedAt:text('updated_at').notNull(),
}, table=>[index('hsc_reminder_member').on(table.memberId)]);
